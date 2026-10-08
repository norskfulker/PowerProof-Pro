import "server-only";
import { planPayout, type PayoutPlan } from "../payout-plan";
import { sbAdmin } from "../supabase/admin";
import type { CurrencyCode } from "../types";
import { CheckoutError } from "./checkout";
import { ensureRates } from "./fx";
import { createPayout, GatewayError, payoutConfig } from "./razorpay";

/**
 * Sends a seller's withdrawal through RazorpayX. Staff trigger it (money moves, so a person looks
 * first). Razorpay's payout webhooks then close the payout as paid or returned.
 */
export async function sendPayout(payoutId: string, actorId: string): Promise<{ gatewayId: string; plan: Extract<PayoutPlan, { route: "razorpayx" }> }> {
  const cfg = payoutConfig();
  if (!cfg) throw new CheckoutError("RazorpayX isn't connected. Set RAZORPAYX_ACCOUNT_NUMBER next to the Razorpay keys.", 503);
  const db = sbAdmin();

  const { data: p } = await db.from("payouts").select("id, status, store_id, method_id, currency, amount_minor, gateway_payout_id").eq("id", payoutId).maybeSingle();
  if (!p) throw new CheckoutError("We can't find that payout.", 404);
  if (p.gateway_payout_id) throw new CheckoutError("That payout was already sent to Razorpay.");
  if (p.status !== "requested" && p.status !== "processing") throw new CheckoutError("That payout is already finished.");

  const [{ data: method }, { data: store }] = await Promise.all([
    db.from("payout_methods").select("kind, gateway_fund_account_id").eq("id", p.method_id).maybeSingle(),
    db.from("stores").select("country").eq("id", p.store_id).maybeSingle(),
  ]);
  if (!method) throw new CheckoutError("The seller removed this payout account. Pay it by hand or mark it failed.");

  let rates;
  try {
    rates = await ensureRates();
  } catch {
    throw new CheckoutError("Exchange rates aren't available right now, so the amount can't be converted. Try again shortly.", 503);
  }
  const plan = planPayout({
    balanceCurrency: p.currency as CurrencyCode,
    amountMinor: Number(p.amount_minor),
    sellerCountry: store?.country ?? null,
    methodKind: (method.kind as "bank" | "upi" | "crypto") ?? null,
    hasFundAccount: !!method.gateway_fund_account_id,
    rates,
  });
  if (plan.route !== "razorpayx") throw new CheckoutError(plan.reason);

  let sent: { id: string };
  try {
    sent = await createPayout(cfg, { fundAccountId: method.gateway_fund_account_id!, amount: plan.amountMinor, mode: plan.mode, reference: p.id });
  } catch (e) {
    throw new CheckoutError(e instanceof GatewayError ? e.message : "Razorpay didn't accept the payout.", 502);
  }

  const { error } = await db
    .from("payouts")
    .update({ gateway_payout_id: sent.id, status: "processing", payout_currency: plan.currency, payout_amount_minor: plan.amountMinor, fx_rate: plan.rate } as never)
    .eq("id", p.id)
    .is("gateway_payout_id", null);
  // The money is already on its way: if we can't record that, say so loudly rather than let it be sent twice
  if (error) throw new CheckoutError(`Razorpay accepted the payout (${sent.id}) but we couldn't record it. Do not send it again; note this id.`, 500);
  await db.from("audit_log").insert({ actor_id: actorId, action: "payout_sent_razorpay", target_type: "payout", target_id: p.id, meta: { gateway_id: sent.id, amount: plan.amountMinor, currency: plan.currency, from: `${p.amount_minor} ${p.currency}`, rate: plan.rate, mode: plan.mode } });
  return { gatewayId: sent.id, plan };
}
