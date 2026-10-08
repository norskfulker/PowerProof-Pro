import "server-only";
import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/server/admin-auth";
import { CheckoutError } from "@/lib/server/checkout";
import { sendPayout } from "@/lib/server/payouts";

/** Staff send one payout through RazorpayX. The seller's account must have been saved with Razorpay. */
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false, message: "Only PowerProof staff can send payouts." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, message: "We can't find that payout." }, { status: 404 });
  try {
    const out = await sendPayout(id, admin.id);
    return NextResponse.json({ ok: true, gatewayId: out.gatewayId, amount: out.plan.amountMinor, currency: out.plan.currency, rate: out.plan.rate });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
    console.error("[payout]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "The payout didn't go through." }, { status: 500 });
  }
}
