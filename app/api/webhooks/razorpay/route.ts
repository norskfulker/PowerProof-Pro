import "server-only";
import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase/admin";
import { razorpayConfig, verifyWebhookSignature } from "@/lib/server/razorpay";
import { handleEvent, type GatewayEvent } from "@/lib/server/razorpay-events";

/**
 * Razorpay tells us about payments even when the buyer closed the tab. Signed over the raw body;
 * marking an order paid is safe to repeat. Set the webhook (events: payment.captured, order.paid,
 * payment.failed, the payment.dispute.* events for chargebacks, and payout.processed / payout.reversed / payout.rejected for seller payouts) to https://<your site>/api/webhooks/razorpay with RAZORPAY_WEBHOOK_SECRET.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cfg = razorpayConfig();
  if (!cfg?.webhookSecret) return NextResponse.json({ ok: false }, { status: 503 });
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature") ?? "", cfg.webhookSecret)) return NextResponse.json({ ok: false }, { status: 400 });
  let ev: GatewayEvent;
  try {
    ev = JSON.parse(raw) as GatewayEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const pay = ev.payload?.payment?.entity;
  const payoutId = ev.payload?.payout?.entity?.id;
  // Razorpay may send the same event more than once: record it, and skip one that was already handled
  const db = sbAdmin();
  const eventId = request.headers.get("x-razorpay-event-id") ?? `${ev.event}:${pay?.id ?? pay?.order_id ?? payoutId ?? "unknown"}`;
  const { data: seen } = await db.from("webhook_events").select("id, processed_at").eq("gateway", "razorpay").eq("event_id", eventId).maybeSingle();
  if (seen?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
  if (!seen) await db.from("webhook_events").insert({ gateway: "razorpay", event_id: eventId, event_type: ev.event, payload: ev as never });
  try {
    await handleEvent(ev);
  } catch (e) {
    console.error("[webhook]", ev.event, e instanceof Error ? e.message : e);
    // Not-found and already-handled are fine; anything else gets retried by Razorpay
    await db.from("webhook_events").update({ error: e instanceof Error ? e.message.slice(0, 300) : "failed" }).eq("gateway", "razorpay").eq("event_id", eventId);
    if (!(e instanceof Error && /find that order/.test(e.message))) return NextResponse.json({ ok: false }, { status: 500 });
  }
  await db.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("gateway", "razorpay").eq("event_id", eventId);
  return NextResponse.json({ ok: true });
}
