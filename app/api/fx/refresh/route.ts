import "server-only";
import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/server/admin-auth";
import { readRates, refreshRates } from "@/lib/server/fx";

/** Staff pull today's exchange rates. They are also refreshed on their own when a payout needs them and they are a day old. */
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false, message: "Only PowerProof staff can do that." }, { status: 403 });
  try {
    await refreshRates();
    return NextResponse.json({ ok: true, ...(await readRates()) });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Rates couldn't be refreshed." }, { status: 502 });
  }
}
