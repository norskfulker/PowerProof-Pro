import "server-only";
import { fromRazorpay, type PaymentEventInput, type RazorpayWebhook } from "../payment-events";
import { sbAdmin } from "../supabase/admin";

/**
 * Writes payment_events. Every write is keyed by (provider, provider_event_id), so a webhook
 * Razorpay sends twice, or a step reported by both the checkout and the webhook, is stored once.
 * Failing to record is logged and never stops the payment itself.
 */

type Target = { orderId?: string; storeId: string };

export async function recordPaymentEvent(target: Target, e: PaymentEventInput): Promise<void> {
  const { error } = await sbAdmin()
    .from("payment_events" as never)
    .upsert(
      {
        order_id: target.orderId ?? null,
        store_id: target.storeId,
        provider: e.provider.slice(0, 40),
        kind: e.kind,
        source: e.source,
        payment_id: e.paymentId?.slice(0, 120) ?? null,
        refund_id: e.refundId?.slice(0, 120) ?? null,
        amount_minor: e.amountMinor ?? null,
        currency: e.currency?.toUpperCase().slice(0, 3) ?? null,
        method: e.method?.slice(0, 40) ?? null,
        reason: e.reason?.slice(0, 300) ?? null,
        error_code: e.errorCode?.slice(0, 80) ?? null,
        provider_event_id: e.providerEventId.slice(0, 200),
        occurred_at: e.occurredAt ?? new Date().toISOString(),
      } as never,
      { onConflict: "provider,provider_event_id", ignoreDuplicates: true }
    );
  if (error) console.error("[payment-events]", e.kind, error.message);
}

/** The order a gateway order or payment id belongs to */
export async function orderFor(ref: { gatewayOrderId?: string; gatewayPaymentId?: string; orderId?: string }): Promise<{ id: string; store_id: string; status: string; total_minor: number; currency: string; gateway: string | null } | null> {
  const db = sbAdmin();
  const q = db.from("orders").select("id, store_id, status, total_minor, currency, gateway");
  const { data } = ref.orderId
    ? await q.eq("id", ref.orderId).maybeSingle()
    : ref.gatewayOrderId
      ? await q.eq("gateway_order_id", ref.gatewayOrderId).maybeSingle()
      : ref.gatewayPaymentId
        ? await q.eq("gateway_payment_id", ref.gatewayPaymentId).maybeSingle()
        : { data: null };
  return (data as never) ?? null;
}

/** A Razorpay webhook's payment step, recorded against its order (unknown orders are skipped) */
export async function recordRazorpayEvent(ev: RazorpayWebhook): Promise<void> {
  const e = fromRazorpay(ev);
  if (!e) return;
  const o = await orderFor({ gatewayOrderId: e.gatewayOrderId, gatewayPaymentId: e.gatewayPaymentId });
  if (!o) return;
  await recordPaymentEvent({ orderId: o.id, storeId: o.store_id }, { ...e, provider: o.gateway === "own_razorpay" ? "own_razorpay" : "razorpay" });
}
