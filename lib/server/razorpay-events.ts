import "server-only";
import { sbAdmin } from "../supabase/admin";
import { completePayment, mailPaymentFailed, mailPayout } from "./shop";

/**
 * What each Razorpay webhook event does. Used by the webhook route and by "Retry" on the admin
 * webhook log, so a failed event is handled exactly the same way the second time.
 */
export interface GatewayEvent {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; fee?: number; error_description?: string } };
    order?: { entity?: { id?: string } };
    dispute?: { entity?: { id?: string; payment_id?: string; amount?: number; currency?: string; reason_code?: string; status?: string; respond_by?: number } };
    payout?: { entity?: { id?: string; status?: string; failure_reason?: string; status_details?: { description?: string } } };
  };
}

/** Razorpay's dispute states, in ours */
const DISPUTE_STATUS: Record<string, string> = { open: "open", action_required: "open", under_review: "under_review", won: "won", lost: "lost", closed: "closed" };

export async function handleEvent(ev: GatewayEvent): Promise<void> {
  const db = sbAdmin();
  const pay = ev.payload?.payment?.entity;
  const payout = ev.payload?.payout?.entity;

  if ((ev.event === "payment.captured" || ev.event === "order.paid") && pay?.id && pay.order_id) {
    await completePayment(pay.order_id, pay.id, pay.fee);
  } else if (ev.event.startsWith("payment.dispute.") && ev.payload?.dispute?.entity?.id && ev.payload.dispute.entity.payment_id) {
    // Chargebacks: shown in the admin console under Orders > Disputed
    const d = ev.payload.dispute.entity;
    const status = DISPUTE_STATUS[d.status ?? ""] ?? DISPUTE_STATUS[ev.event.replace("payment.dispute.", "")] ?? "open";
    const recorded = await db.rpc("record_dispute" as never, { p_payment_id: d.payment_id, p_dispute_id: d.id, p_amount: d.amount ?? 0, p_currency: d.currency ?? "INR", p_reason: d.reason_code ?? null, p_status: status, p_respond_by: d.respond_by ? new Date(d.respond_by * 1000).toISOString() : null } as never);
    if (recorded.error) throw new Error(recorded.error.message);
  } else if (ev.event === "payment.failed" && pay?.order_id) {
    const { data: failed } = await db.from("orders").update({ status: "failed" }).eq("gateway_order_id", pay.order_id).eq("status", "pending").select("id");
    // Only the first failure on an order emails the buyer (a repeated event changes nothing)
    for (const o of failed ?? []) await mailPaymentFailed(o.id, pay.error_description).catch((e) => console.error("[mail] payment-failed email", e instanceof Error ? e.message : e));
  } else if (payout?.id && (ev.event === "payout.processed" || ev.event === "payout.reversed" || ev.event === "payout.rejected" || ev.event === "payout.failed")) {
    // RazorpayX: the money reached the seller's account, or came back
    const ok = ev.event === "payout.processed";
    if (!ok) {
      const { data: row } = await db.from("payouts").select("status").eq("gateway_payout_id", payout.id).maybeSingle();
      // Returned after we already called it paid: the books need a person, so make it show up as a failed event
      if (row?.status === "paid") throw new Error(`Payout ${payout.id} was returned after it was marked paid. Fix the seller's balance by hand.`);
    }
    const reason = ok ? null : (payout.failure_reason || payout.status_details?.description || `Razorpay: ${ev.event.replace("payout.", "")}`).slice(0, 200);
    const done = await db.rpc("settle_payout_by_gateway" as never, { p_gateway_id: payout.id, p_ok: ok, p_reason: reason } as never);
    if (done.error) throw new Error(done.error.message);
    await mailPayout(payout.id, ok, reason ?? undefined).catch((e) => console.error("[mail] payout email", e instanceof Error ? e.message : e));
  }
}
