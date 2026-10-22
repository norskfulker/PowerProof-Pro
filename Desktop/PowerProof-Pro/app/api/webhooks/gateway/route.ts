import "server-only";
import { NextResponse } from "next/server";
import { directGatewayFor, signatureOk, stripePaid, stripeSignatureOk } from "@/lib/server/gateways";
import { completePayment } from "@/lib/server/shop";
import { sbAdmin } from "@/lib/supabase/admin";

/**
 * Payment news from a store's own gateway. ?gw=custom: our documented contract, signed with the
 * store's signing secret (X-PowerProof-Signature: HMAC-SHA256 of the raw body, hex), body
 * { orderId, paymentId, status: "paid", amount, currency }. ?gw=stripe: Stripe's
 * checkout.session.completed, signed with the store's webhook secret (Stripe-Signature).
 * The order decides which store's secret is used; an unsigned or wrong call changes nothing.
 */
export const dynamic = "force-dynamic";

const no = (status = 400) => NextResponse.json({ ok: false }, { status });

export async function POST(request: Request) {
  const gwName = new URL(request.url).searchParams.get("gw");
  const raw = await request.text();
  if (raw.length > 64_000) return no(413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return no();
  }
  const db = sbAdmin();

  if (gwName === "custom") {
    const orderId = String(body.orderId ?? "");
    const { data: o } = await db.from("orders").select("store_id, gateway, total_minor, currency").eq("gateway_order_id", orderId).maybeSingle();
    if (!o || o.gateway !== "custom") return no(404);
    const gw = await directGatewayFor(o.store_id);
    if (!gw || gw.provider !== "custom" || !gw.secrets.webhookSecret || !signatureOk(gw.secrets.webhookSecret, raw, request.headers.get("x-powerproof-signature") ?? "")) return no(401);
    if (body.status !== "paid") return NextResponse.json({ ok: true, ignored: true });
    if (Number(body.amount) !== Number(o.total_minor) || String(body.currency ?? "").toUpperCase() !== o.currency.toUpperCase()) return no(422);
    await completePayment(orderId, String(body.paymentId ?? orderId).slice(0, 120), undefined, true);
    return NextResponse.json({ ok: true });
  }

  if (gwName === "stripe") {
    const session = ((body.data as { object?: Record<string, unknown> } | undefined)?.object ?? {}) as { id?: string };
    if (body.type !== "checkout.session.completed" || !session.id) return NextResponse.json({ ok: true, ignored: true });
    const { data: o } = await db.from("orders").select("store_id, gateway, total_minor, currency").eq("gateway_order_id", session.id).maybeSingle();
    if (!o || o.gateway !== "stripe") return NextResponse.json({ ok: true, ignored: true });
    const gw = await directGatewayFor(o.store_id);
    if (!gw || gw.provider !== "stripe" || !gw.secrets.webhookSecret || !stripeSignatureOk(gw.secrets.webhookSecret, raw, request.headers.get("stripe-signature") ?? "")) return no(401);
    // Read back from Stripe rather than trusting the body
    const paymentId = await stripePaid(gw, session.id, Number(o.total_minor), o.currency);
    if (paymentId) await completePayment(session.id, paymentId, undefined, true);
    return NextResponse.json({ ok: true });
  }

  return no(404);
}
