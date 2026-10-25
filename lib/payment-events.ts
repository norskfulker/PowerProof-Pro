/**
 * Payment activity: one row per step of an order's payment (payment_events). Pure helpers shared
 * by the server (turning gateway webhooks into rows) and the screens (labels, the current status).
 */

export const PAYMENT_EVENT_KINDS = [
  "initiated",
  "pending",
  "succeeded",
  "failed",
  "abandoned",
  "cancelled",
  "expired",
  "refund_requested",
  "refund_processing",
  "refunded",
  "refund_failed",
  "late_payment",
  "disputed",
] as const;
export type PaymentEventKind = (typeof PAYMENT_EVENT_KINDS)[number];

/** provider: the gateway said so; app: our server or checkout did it; inferred: worked out without the gateway confirming */
export type PaymentEventSource = "provider" | "app" | "inferred";

export interface PaymentEventInput {
  kind: PaymentEventKind;
  source: PaymentEventSource;
  provider: string;
  /** Same step reported twice is stored once: a deterministic id per payment (or refund) and step */
  providerEventId: string;
  paymentId?: string;
  refundId?: string;
  amountMinor?: number;
  currency?: string;
  method?: string;
  /** The provider's own words. Never filled in by us when the provider gave none. */
  reason?: string;
  errorCode?: string;
  /** When it happened at the provider (webhooks can arrive late or out of order) */
  occurredAt?: string;
}

export const PAYMENT_EVENT_LABEL: Record<PaymentEventKind, string> = {
  initiated: "Payment started",
  pending: "Payment pending",
  succeeded: "Payment successful",
  failed: "Payment failed",
  abandoned: "Transaction abandoned",
  cancelled: "Payment cancelled",
  expired: "Payment expired",
  refund_requested: "Refund requested",
  refund_processing: "Refund processing",
  refunded: "Refund completed",
  refund_failed: "Refund failed",
  late_payment: "Paid after cancellation",
  disputed: "Payment disputed",
};

export type PaymentTone = "success" | "warning" | "danger" | "info" | "neutral";
export const PAYMENT_EVENT_TONE: Record<PaymentEventKind, PaymentTone> = {
  initiated: "neutral",
  pending: "info",
  succeeded: "success",
  failed: "danger",
  abandoned: "warning",
  cancelled: "neutral",
  expired: "warning",
  refund_requested: "info",
  refund_processing: "info",
  refunded: "neutral",
  refund_failed: "danger",
  late_payment: "danger",
  disputed: "danger",
};

/** Kinds whose reason matters: a missing one is shown as "Reason unavailable" */
export const NEEDS_REASON: PaymentEventKind[] = ["failed", "cancelled", "expired", "refund_failed", "abandoned", "disputed"];

/* Razorpay webhooks ------------------------------------------------------------------------ */

export interface RazorpayPayment {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  fee?: number;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  created_at?: number;
}
export interface RazorpayRefund {
  id?: string;
  payment_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  created_at?: number;
}
export interface RazorpayWebhook {
  event: string;
  created_at?: number;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    refund?: { entity?: RazorpayRefund };
    dispute?: { entity?: { id?: string; payment_id?: string; amount?: number; currency?: string; reason_code?: string; reason_description?: string; status?: string } };
  };
}

const iso = (unix?: number) => (unix ? new Date(unix * 1000).toISOString() : undefined);
const clean = (s?: string | null) => (s && s.trim() && s.trim().toUpperCase() !== "NA" ? s.trim().slice(0, 300) : undefined);

/**
 * A Razorpay webhook as a payment event, plus what it belongs to (the gateway order or payment).
 * Null for events that aren't about an order's payment (subscriptions, payouts). payment.captured
 * and order.paid describe the same payment, so both become one "succeeded" row.
 */
export function fromRazorpay(ev: RazorpayWebhook): (PaymentEventInput & { gatewayOrderId?: string; gatewayPaymentId?: string }) | null {
  const pay = ev.payload?.payment?.entity;
  const refund = ev.payload?.refund?.entity;
  const at = iso(ev.created_at);
  const base = { source: "provider" as const, provider: "razorpay" };

  if (refund?.id && ev.event.startsWith("refund.")) {
    const kind: PaymentEventKind | null = ev.event === "refund.processed" ? "refunded" : ev.event === "refund.failed" ? "refund_failed" : ev.event === "refund.created" ? "refund_processing" : null;
    if (!kind) return null;
    return { ...base, kind, providerEventId: `rzp:${refund.id}:${kind}`, refundId: refund.id, paymentId: refund.payment_id, gatewayPaymentId: refund.payment_id, amountMinor: refund.amount, currency: refund.currency, occurredAt: at };
  }

  const dispute = ev.payload?.dispute?.entity;
  if (dispute?.id && ev.event.startsWith("payment.dispute.")) {
    return { ...base, kind: "disputed", providerEventId: `rzp:${dispute.id}:${ev.event}`, paymentId: dispute.payment_id, gatewayPaymentId: dispute.payment_id, amountMinor: dispute.amount, currency: dispute.currency, reason: clean(dispute.reason_description) ?? clean(dispute.reason_code), errorCode: clean(dispute.reason_code), occurredAt: at };
  }

  if (!pay?.id || pay.order_id === undefined) return null;
  const kind: PaymentEventKind | null =
    ev.event === "payment.captured" || ev.event === "order.paid" ? "succeeded" : ev.event === "payment.failed" ? "failed" : ev.event === "payment.authorized" ? "pending" : null;
  if (!kind) return null;
  const code = [clean(pay.error_code), clean(pay.error_reason)].filter(Boolean).join(" · ");
  return {
    ...base,
    kind,
    providerEventId: `rzp:${pay.id}:${kind}`,
    paymentId: pay.id,
    gatewayOrderId: pay.order_id,
    amountMinor: pay.amount,
    currency: pay.currency,
    method: clean(pay.method),
    reason: kind === "failed" ? clean(pay.error_description) : undefined,
    errorCode: kind === "failed" && code ? code : undefined,
    occurredAt: at ?? iso(pay.created_at),
  };
}

/* The current state --------------------------------------------------------------------------- */

export interface PaymentEventRow {
  kind: PaymentEventKind;
  occurredAt: string;
}

/** Later steps of a payment win over earlier ones that arrive late (a "failed" webhook after "succeeded") */
const RANK: Record<PaymentEventKind, number> = {
  initiated: 0,
  abandoned: 1,
  pending: 2,
  failed: 3,
  cancelled: 4,
  expired: 5,
  succeeded: 6,
  late_payment: 7,
  refund_requested: 8,
  refund_processing: 9,
  refund_failed: 10,
  refunded: 11,
  disputed: 12,
};

/**
 * The payment's status now, from its events in any order: the latest by time, except that a step
 * can't be undone by an earlier one delivered late (a retry that succeeds after a failure is newer,
 * so it wins either way).
 */
export function currentPaymentState(events: PaymentEventRow[]): PaymentEventKind | undefined {
  if (!events.length) return undefined;
  const sorted = [...events].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || RANK[a.kind] - RANK[b.kind]);
  let state = sorted[0].kind;
  for (const e of sorted.slice(1)) {
    // A success is only replaced by what can follow it (refunds, disputes, a late-payment flag)
    if (state === "succeeded" && RANK[e.kind] < RANK.succeeded) continue;
    if (state === "refunded" && e.kind !== "disputed") continue;
    state = e.kind;
  }
  return state;
}

/* The unpaid-order timeout ---------------------------------------------------------------------- */

export const UNPAID_TIMEOUT_MS = 60 * 60 * 1000;
export const UNPAID_CANCEL_REASON = "Payment not received within 1 hour";

/** Whether an order is waiting on an online payment that can still arrive, and until when */
export function unpaidDeadline(o: { status: string; paymentMethod?: string | null; createdAt: string }): number | undefined {
  if (o.paymentMethod === "cod" || (o.status !== "pending" && o.status !== "failed")) return undefined;
  return Date.parse(o.createdAt) + UNPAID_TIMEOUT_MS;
}

/** "Cancels in 23 min", or "Cancelling now" once the hour is up (the next scheduled run cancels it) */
export function unpaidCountdown(deadline: number, now = Date.now()): string {
  const left = deadline - now;
  if (left <= 0) return "Cancelling now";
  const min = Math.ceil(left / 60_000);
  return `Cancels in ${min} min`;
}
