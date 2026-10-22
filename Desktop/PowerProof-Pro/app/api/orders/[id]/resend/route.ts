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
  if (r && r.sent) {
    // Into the order's activity, as the person who sent it
    const [{ data: me }, { data: o }] = await Promise.all([db.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle(), sbAdmin().from("orders").select("store_id").eq("id", id).single()]);
    if (o) await sbAdmin().from("order_events").insert({ order_id: id, store_id: o.store_id, kind: "receipt_resent", actor_id: auth.user.id, actor_name: me?.full_name?.trim() || me?.email || null });
  }
  return r && r.sent ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, message: "The email couldn't be sent. Try again in a minute." }, { status: 502 });
}
