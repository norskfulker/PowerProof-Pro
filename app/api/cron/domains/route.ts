import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkAllDomains } from "@/lib/server/domains";

/**
 * Re-checks custom domains on a schedule, so one goes live as soon as its DNS records are found
 * even with nobody on the Domain page. The Worker's cron trigger (wrangler.jsonc, worker.ts) calls
 * it with `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set, the route does nothing.
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
    return NextResponse.json({ ok: true, ...(await checkAllDomains()) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[cron/domains]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
