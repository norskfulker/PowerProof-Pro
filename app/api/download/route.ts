import "server-only";
import { NextResponse } from "next/server";
import { downloadLink } from "@/lib/server/shop";

/** One file from a paid order, by the link token in the buyer's email: counted, then a 60-second private link. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const t = url.searchParams.get("t") ?? "";
  const f = url.searchParams.get("f") ?? "";
  if (!/^[a-f0-9]{48}$/.test(t) || !/^[0-9a-f-]{36}$/.test(f)) return NextResponse.json({ ok: false, message: "That download link isn't right." }, { status: 400 });
  let link: string | null;
  try {
    link = await downloadLink(t, f);
  } catch (e) {
    console.error("[download]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "Downloads aren't available right now. Please try again in a few minutes." }, { status: 503 });
  }
  if (link === "limit") return NextResponse.json({ ok: false, message: "This link has reached its download limit. Look your order up to get a new one." }, { status: 429 });
  if (!link) return NextResponse.json({ ok: false, message: "That download link has expired or isn't valid." }, { status: 404 });
  return NextResponse.redirect(link, { status: 302, headers: { "cache-control": "no-store" } });
}
