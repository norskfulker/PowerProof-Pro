import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { mailConfigured } from "@/lib/server/email";
import { mailShipped } from "@/lib/server/shop";
import { sbServer } from "@/lib/supabase/server";

/**
 * A creator ships one of their orders: sent (with tracking), delivered, cash collected (cash on
 * delivery), or cancelled (a COD order that won't be delivered). The database checks the order is
 * theirs and that the step makes sense; the buyer gets an email when it's sent or delivered.
 */
export const dynamic = "force-dynamic";

const body = z.object({
  step: z.enum(["shipped", "delivered", "cod_paid", "cancelled"]),
  carrier: z.string().trim().max(60).optional(),
  number: z.string().trim().max(80).optional(),
  url: z.string().trim().max(500).refine((v) => v === "" || /^https:\/\//.test(v), "Tracking links start with https://").optional(),
  notify: z.boolean().default(true),
});

const REASONS: Record<string, string> = {
  order_not_found: "We can't find that order.",
  nothing_to_ship: "Nothing in this order is shipped.",
  order_not_shippable: "Only paid or cash-on-delivery orders can be shipped.",
  bad_fulfilment_step: "That step doesn't fit where the order is now. Refresh and try again.",
  refund_instead: "This order is paid, so refund it instead of cancelling.",
  bad_tracking_url: "Tracking links start with https://",
  not_cod: "This order isn't cash on delivery.",
};

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again." }, { status: 401 });
  const { step, carrier, number, url, notify } = parsed.data;

  const r =
    step === "cod_paid"
      ? await db.rpc("settle_cod", { p_order: id })
      : await db.rpc("set_order_fulfilment", { p_order: id, p_status: step, p_carrier: carrier, p_number: number, p_url: url });
  if (r.error) {
    const key = Object.keys(REASONS).find((k) => r.error!.message.includes(k));
    if (!key) console.error("[fulfil]", r.error.message);
    return NextResponse.json({ ok: false, message: key ? REASONS[key] : "That didn't save. Try again." }, { status: key ? 400 : 500 });
  }

  let emailed = false;
  if (notify && (step === "shipped" || step === "delivered") && mailConfigured()) {
    const m = await mailShipped(id, step === "delivered").catch(() => undefined);
    emailed = !!m && m.sent;
  }
  return NextResponse.json({ ok: true, emailed });
}
