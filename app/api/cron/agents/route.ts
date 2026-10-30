import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { tick } from "@/lib/server/agents/jobs";

/**
 * The agents' scheduler tick: adds due jobs (hourly runs, Monday reports, daily sheet refreshes),
 * then runs a small batch inside the time budget and returns. Called by the Worker's cron with
 * `Authorization: Bearer $CRON_SECRET` (same as /api/cron/abandoned); without
 * CRON_SECRET set, the route does nothing.
 */
export const dynamic = "force-dynamic";

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await tick({ budgetMs: 25_000, batch: 8 })) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[cron/agents]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
