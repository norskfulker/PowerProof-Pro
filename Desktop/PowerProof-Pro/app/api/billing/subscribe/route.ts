import "server-only";
import { NextResponse } from "next/server";
import { BillingError, startSubscription } from "@/lib/server/billing";
import { sbServer } from "@/lib/supabase/server";

/** Starts a Pro subscription (₹1,999/mo, first 30 days free, card authorised now). */
export const dynamic = "force-dynamic";

export async function POST() {
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again." }, { status: 401 });
  try {
    const out = await startSubscription(auth.user.id);
    return NextResponse.json({ ok: true, ...out }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
    console.error("[billing/subscribe]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "We couldn't start that. Try again." }, { status: 500 });
  }
}
