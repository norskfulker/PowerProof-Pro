import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, clientKey } from "@/lib/server/limit";
import { CheckoutError } from "@/lib/server/checkout";
import { quoteCheckout } from "@/lib/server/shop";

/**
 * The live total at checkout for orders with something to ship: shipping for the country, cash on
 * delivery, stock, deals and the code, priced by the same code that charges. Writes nothing.
 */
export const dynamic = "force-dynamic";

const body = z.object({
  storeSlug: z.string().min(1).max(60),
  productIds: z.array(z.string().uuid()).min(1).max(20),
  lines: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), quantity: z.number().int().min(1).max(99) })).max(20).optional(),
  coupon: z.string().max(40).optional(),
  country: z.string().regex(/^[A-Z]{2}$/),
  cod: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!allow(`quote:${clientKey(request)}`, 120, 10 * 60_000)) return NextResponse.json({ ok: false, message: "Too many requests. Wait a moment." }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Check the order and try again." }, { status: 400 });
  try {
    const q = await quoteCheckout(parsed.data);
    return NextResponse.json({ ok: true, ...q }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
    console.error("[quote]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "We couldn't work out the total. Try again." }, { status: 500 });
  }
}
