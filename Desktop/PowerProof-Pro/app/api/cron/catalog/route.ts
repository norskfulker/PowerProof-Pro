import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runCatalogJobs } from "@/lib/server/shop";

/**
 * Scheduled publishing and low-stock emails (lib/server/shop.ts runCatalogJobs). The Worker's cron trigger
 * (wrangler.jsonc, worker.ts) calls it with `Authorization: Bearer $CRON_SECRET`; without
 * CRON_SECRET set, the route does nothing. Emails need RESEND_API_KEY and MAIL_FROM.
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
    return NextResponse.json({ ok: true, ...(await runCatalogJobs()) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[cron/catalog]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
