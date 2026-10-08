import "server-only";
import { NextResponse } from "next/server";
import { mailConfigured } from "@/lib/server/email";
import { mailReceipt } from "@/lib/server/shop";
import { sbAdmin } from "@/lib/supabase/admin";
import { sbServer } from "@/lib/supabase/server";

/** A creator sends the buyer a fresh receipt with a new download link. */
export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again." }, { status: 401 });
  const { data: mine } = await db.from("creator_orders").select("id, status").eq("id", id).maybeSingle();
  if (!mine) return NextResponse.json({ ok: false, message: "We can't find that order." }, { status: 404 });
  if (mine.status !== "paid") return NextResponse.json({ ok: false, message: "Only a paid order has a receipt to send." }, { status: 400 });
  if (!mailConfigured()) return NextResponse.json({ ok: false, message: "Email isn't connected yet, so nothing was sent." }, { status: 503 });
  const t = await sbAdmin().rpc("issue_download_token", { p_order: id });
  const r = await mailReceipt(id, (t.data as string | null) ?? "");
  return r && r.sent ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, message: "The email couldn't be sent. Try again in a minute." }, { status: 502 });
}
