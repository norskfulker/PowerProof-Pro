import "server-only";
import { NextResponse } from "next/server";
import { BillingError, billingStatus, cancelNow } from "@/lib/server/billing";
import { sbServer } from "@/lib/supabase/server";

/** The creator's subscription state and simple receipts for Settings › Billing. */
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await billingStatus(auth.user.id)) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[billing/status]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "We couldn't load billing just now." }, { status: 500 });
  }
}

export async function DELETE() {
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again." }, { status: 401 });
  try {
    await cancelNow(auth.user.id);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
    console.error("[billing/cancel]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "We couldn't cancel that. Try again." }, { status: 500 });
  }
}
