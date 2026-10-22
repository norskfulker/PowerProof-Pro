import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BillingError, confirmSubscription } from "@/lib/server/billing";
import { sbServer } from "@/lib/supabase/server";

/** Confirms the subscription authorisation the browser brings back from Razorpay. */
export const dynamic = "force-dynamic";

const body = z.object({
  paymentId: z.string().min(1).max(80),
  subscriptionId: z.string().min(1).max(80),
  signature: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const p = body.safeParse(await request.json().catch(() => null));
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again." }, { status: 401 });
  if (!p.success) return NextResponse.json({ ok: false, message: "Check the details and try again." }, { status: 400 });
  try {
    await confirmSubscription(auth.user.id, p.data);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
    console.error("[billing/verify]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "We couldn't confirm that. Try again." }, { status: 500 });
  }
}
