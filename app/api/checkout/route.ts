import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, clientKey } from "@/lib/server/limit";
import { CheckoutError } from "@/lib/server/checkout";
import { createCheckout } from "@/lib/server/shop";
import { shipToSchema } from "@/lib/shipping";

/**
 * Starts an order. The browser says which products (and which code) and who is buying; the price is
 * worked out here. Anyone can call it, so it is rate limited, and it only ever creates a pending order.
 */
export const dynamic = "force-dynamic";

const body = z.object({
  storeSlug: z.string().min(1).max(60),
  productIds: z.array(z.string().uuid()).min(1).max(20),
  /** Physical products: the variant and how many */
  lines: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), quantity: z.number().int().min(1).max(99) })).max(20).optional(),
  shipTo: shipToSchema.optional(),
  paymentMethod: z.enum(["online", "cod"]).default("online"),
  coupon: z.string().max(40).optional(),
  giftChoices: z.record(z.string(), z.string()).optional(),
  bumpProductId: z.string().uuid().optional(),
  buyer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().max(254).email(),
    phone: z.string().trim().min(6).max(30),
    country: z.string().regex(/^[A-Z]{2}$/),
    consent: z.literal(true),
  }),
});

const fail = (message: string, status: number) => NextResponse.json({ ok: false, message }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  if (!allow(`checkout:${clientKey(request)}`, 12, 10 * 60_000)) return fail("Too many attempts. Please wait a few minutes and try again.", 429);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "Invalid literal value, expected true") return fail("Please accept the terms and refund policy to continue.", 400);
    // Address problems say which field
    if (issue?.path[0] === "shipTo" && issue.message && !/^(Required|Expected|Invalid)/.test(issue.message)) return fail(issue.message, 400);
    return fail(issue?.path[0] === "shipTo" ? "Check the delivery address and try again." : "Check your details and try again.", 400);
  }
  const { consent: _consent, ...buyer } = parsed.data.buyer;
  void _consent;
  try {
    const reply = await createCheckout({ ...parsed.data, buyer });
    return NextResponse.json({ ok: true, ...reply }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof CheckoutError) return fail(e.message, e.status);
    console.error("[checkout]", e instanceof Error ? e.message : e);
    return fail("Something went wrong on our side. You haven't been charged. Please try again.", 500);
  }
}
