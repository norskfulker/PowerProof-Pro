import "server-only";
import { trialEndsAt } from "../plans";
import { sbAdmin } from "../supabase/admin";
import {
  cancelRzSubscription,
  createRzCustomer,
  createRzSubscription,
  fetchRzSubscription,
  proPlanId,
  razorpayConfig,
  verifySubscriptionSignature,
  type RazorpayConfig,
} from "./razorpay";

export class BillingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const needCfg = (): RazorpayConfig => {
  const cfg = razorpayConfig();
  if (!cfg) throw new BillingError("Billing isn't connected yet. Set the Razorpay keys first.", 503);
  return cfg;
};

const needPlan = (): string => {
  const plan = proPlanId();
  if (!plan) throw new BillingError("Billing isn't connected yet. Set RAZORPAY_PRO_PLAN_ID first.", 503);
  return plan;
};

export interface BillingStatus {
  tier: "free" | "pro";
  subscription: {
    id: string;
    status: string;
    trialEndsAt: string | null;
    currentEnd: string | null;
  } | null;
  receipts: {
    id: string;
    amountMinor: number;
    currency: string;
    paymentId: string;
    createdAt: string;
  }[];
}

async function profileOf(userId: string) {
  const db = sbAdmin();
  const { data } = await db.from("profiles").select("plan, email, full_name").eq("id", userId).single();
  return data;
}

/**
 * Starts (or resumes) a Pro subscription: one Razorpay customer per creator, one
 * subscription row per creator. The trial ends 30 days out; the card is authorised now.
 */
export async function startSubscription(userId: string): Promise<{ keyId: string; subscriptionId: string; trialEndsAt: string }> {
  const cfg = needCfg();
  const planId = needPlan();
  const db = sbAdmin();
  const me = await profileOf(userId);
  if (!me) throw new BillingError("Log in again.", 401);
  if (me.plan === "pro") {
    const { data: existing } = await db
      .from("billing_subscriptions")
      .select("razorpay_subscription_id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing && ["authenticated", "active", "created"].includes(existing.status)) {
      throw new BillingError("You're already on Pro.", 409);
    }
  }

  const { data: row } = await db.from("billing_subscriptions").select("*").eq("user_id", userId).maybeSingle();
  let customerId = (row?.razorpay_customer_id as string) || "";
  if (!customerId) {
    const email = (me.email || "").toLowerCase();
    if (!email) throw new BillingError("Add an email to your account first.", 400);
    const customer = await createRzCustomer(cfg, { name: me.full_name || email, email });
    customerId = customer.id;
  }

  const trial = trialEndsAt();
  const sub = await createRzSubscription(cfg, {
    planId,
    customerId,
    trialEndsAtUnix: Math.floor(trial.getTime() / 1000),
    notes: { user_id: userId },
  });

  await db.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      razorpay_customer_id: customerId,
      razorpay_subscription_id: sub.id,
      status: "created",
      trial_ends_at: trial.toISOString(),
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" }
  );
  return { keyId: cfg.keyId, subscriptionId: sub.id, trialEndsAt: trial.toISOString() };
}

/** Confirms the browser's subscription-auth proof, then flips the account to Pro. */
export async function confirmSubscription(userId: string, o: { paymentId: string; subscriptionId: string; signature: string }): Promise<void> {
  const cfg = needCfg();
  if (!verifySubscriptionSignature(o.paymentId, o.subscriptionId, o.signature, cfg.keySecret)) {
    throw new BillingError("We couldn't confirm that authorisation.", 400);
  }
  const live = await fetchRzSubscription(cfg, o.subscriptionId).catch(() => null);
  if (!live || !["authenticated", "active"].includes(live.status)) {
    throw new BillingError("That authorisation isn't active yet. Try again in a moment.", 409);
  }
  await markPro(userId, o.subscriptionId, live);
}

/** Records an authorised/active subscription and flips profiles.plan to pro. */
export async function markPro(userId: string, subscriptionId: string, live?: { status?: string; start_at?: number; current_start?: number; current_end?: number }): Promise<void> {
  const db = sbAdmin();
  const patch: Record<string, unknown> = {
    razorpay_subscription_id: subscriptionId,
    status: live?.status === "active" ? "active" : "authenticated",
    updated_at: new Date().toISOString(),
  };
  if (live?.current_start) patch.current_start = new Date(live.current_start * 1000).toISOString();
  if (live?.current_end) patch.current_end = new Date(live.current_end * 1000).toISOString();
  await db.from("billing_subscriptions").update(patch as never).eq("user_id", userId).eq("razorpay_subscription_id", subscriptionId);
  await db.from("profiles").update({ plan: "pro" } as never).eq("id", userId);
  await db.from("audit_log").insert({
    actor_id: userId,
    action: "billing_pro_started",
    target_type: "profile",
    target_id: userId,
    meta: { subscription: subscriptionId },
  } as never);
}

/** A subscription receipt (one row per Razorpay payment; safe to record twice). */
export async function recordReceipt(o: { userId: string; subscriptionId?: string; paymentId: string; amountMinor: number; currency?: string; periodStart?: string; periodEnd?: string }): Promise<void> {
  if (!o.paymentId) return;
  const db = sbAdmin();
  let subRowId: string | null = null;
  if (o.subscriptionId) {
    const { data } = await db.from("billing_subscriptions").select("id").eq("razorpay_subscription_id", o.subscriptionId).maybeSingle();
    subRowId = (data?.id as string) ?? null;
  }
  await db.from("billing_receipts").upsert(
    {
      user_id: o.userId,
      subscription_id: subRowId,
      razorpay_payment_id: o.paymentId,
      amount_minor: Math.max(0, Math.round(o.amountMinor)),
      currency: (o.currency ?? "INR").slice(0, 3),
      period_start: o.periodStart ?? null,
      period_end: o.periodEnd ?? null,
    } as never,
    { onConflict: "razorpay_payment_id" } as never
  );
}

/** Cancels now at Razorpay and drops the account back to Free. Receipts stay. */
export async function cancelNow(userId: string): Promise<void> {
  const cfg = needCfg();
  const db = sbAdmin();
  const { data: row } = await db.from("billing_subscriptions").select("razorpay_subscription_id, status").eq("user_id", userId).maybeSingle();
  const subId = row?.razorpay_subscription_id as string | undefined;
  if (subId) await cancelRzSubscription(cfg, subId).catch(() => undefined);
  await db.from("billing_subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() } as never).eq("user_id", userId);
  await db.from("profiles").update({ plan: "free" } as never).eq("id", userId);
  await db.from("audit_log").insert({
    actor_id: userId,
    action: "billing_pro_cancelled",
    target_type: "profile",
    target_id: userId,
    meta: { subscription: subId ?? null },
  } as never);
}

export async function billingStatus(userId: string): Promise<BillingStatus> {
  const db = sbAdmin();
  const [me, sub, receipts] = await Promise.all([
    db.from("profiles").select("plan").eq("id", userId).single(),
    db.from("billing_subscriptions").select("razorpay_subscription_id, status, trial_ends_at, current_end").eq("user_id", userId).maybeSingle(),
    db.from("billing_receipts").select("id, amount_minor, currency, razorpay_payment_id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(24),
  ]);
  return {
    tier: me.data?.plan === "pro" ? "pro" : "free",
    subscription: sub.data
      ? {
          id: sub.data.razorpay_subscription_id as string,
          status: sub.data.status as string,
          trialEndsAt: (sub.data.trial_ends_at as string) ?? null,
          currentEnd: (sub.data.current_end as string) ?? null,
        }
      : null,
    receipts: (receipts.data ?? []).map((r) => ({
      id: r.id as string,
      amountMinor: r.amount_minor as number,
      currency: r.currency as string,
      paymentId: r.razorpay_payment_id as string,
      createdAt: r.created_at as string,
    })),
  };
}
