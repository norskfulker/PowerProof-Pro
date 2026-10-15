import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CheckoutError } from "@/lib/server/checkout";
import { razorpayConfig, verifyPaymentSignature } from "@/lib/server/razorpay";
import { completePayment } from "@/lib/server/shop";
import { directGatewayFor, ownRazorpayPaid } from "@/lib/server/gateways";
import { sbAdmin } from "@/lib/supabase/admin";

/** After the buyer pays, the browser brings back Razorpay's signed proof. Only a valid proof marks an order paid. */
export const dynamic = "force-dynamic";

const body = z.object({ gatewayOrderId: z.string().min(1).max(80), paymentId: z.string().min(1).max(80), signature: z.string().min(1).max(200) });
const fail = (message: string, status: number) => NextResponse.json({ ok: false, message }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("We couldn't confirm that payment.", 400);
  const { gatewayOrderId, paymentId, signature } = parsed.data;
  // Paid into the store's own Razorpay account: checked with that account's secret
  const { data: order } = await sbAdmin().from("orders").select("store_id, gateway").eq("gateway_order_id", gatewayOrderId).maybeSingle();
  const direct = order?.gateway === "own_razorpay";
  if (direct) {
    const gw = await directGatewayFor(order.store_id);
    if (!gw || gw.provider !== "own_razorpay" || !ownRazorpayPaid(gw, gatewayOrderId, paymentId, signature)) return fail("We couldn't confirm that payment.", 400);
  } else {
    const cfg = razorpayConfig();
    if (!cfg || !verifyPaymentSignature(gatewayOrderId, paymentId, signature, cfg.keySecret)) return fail("We couldn't confirm that payment.", 400);
  }
  try {
    const done = await completePayment(gatewayOrderId, paymentId, undefined, direct);
    return NextResponse.json({ ok: true, orderId: done.orderId, token: done.token }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof CheckoutError) return fail(e.message, e.status);
    console.error("[verify]", e instanceof Error ? e.message : e);
    return fail("We received your payment but couldn't finish the order. Don't pay again: check your email, or look your order up in a minute.", 500);
  }
}
