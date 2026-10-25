import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, clientKey } from "@/lib/server/limit";
import { orderFor, recordPaymentEvent } from "@/lib/server/payment-events";

/**
 * The checkout's own signal that the buyer closed the payment window without paying (Razorpay's
 * `ondismiss`). It's an app signal, not the provider's: stored with source "app", and only for an
 * order that is still unpaid (cancelled after an hour). A payment that later succeeds is newer and wins.
 */
export const dynamic = "force-dynamic";

const body = z.object({ gatewayOrderId: z.string().min(1).max(80), kind: z.literal("abandoned") });

export async function POST(request: Request) {
  if (!allow(`payment-event:${clientKey(request)}`, 30, 3_600_000)) return NextResponse.json({ ok: false }, { status: 429 });
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return NextResponse.json({ ok: false }, { status: 400 });
  const o = await orderFor({ gatewayOrderId: b.data.gatewayOrderId });
  // Only an unpaid order can be "abandoned"
  if (!o || (o.status !== "pending" && o.status !== "failed")) return NextResponse.json({ ok: true, ignored: true });
  const minute = Math.floor(Date.now() / 60_000);
  await recordPaymentEvent(
    { orderId: o.id, storeId: o.store_id },
    { kind: "abandoned", source: "app", provider: o.gateway ?? "razorpay", providerEventId: `app:abandoned:${o.id}:${minute}`, amountMinor: Number(o.total_minor), currency: o.currency, reason: "The buyer closed the payment window" }
  );
  return NextResponse.json({ ok: true });
}
