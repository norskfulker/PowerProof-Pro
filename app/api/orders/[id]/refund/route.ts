import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CheckoutError } from "@/lib/server/checkout";
import { refundOrder } from "@/lib/server/shop";
import { sbAdmin } from "@/lib/supabase/admin";
import { sbServer } from "@/lib/supabase/server";

/** A creator refunds one of their own orders, or PowerProof staff refund any order (and it is written to the audit log). Who is asking is checked with their own session, then the money moves with the server key. */
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = z.object({ reason: z.string().trim().max(200).optional() }).safeParse(await request.json().catch(() => ({})));
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again to refund." }, { status: 401 });
  const { data: claims } = await db.auth.getClaims();
  const staff = (claims?.claims?.app_metadata as { role?: string } | undefined)?.role === "admin";
  if (!staff) {
    // creator_orders only holds this creator's orders
    const { data: mine } = await db.from("creator_orders").select("id").eq("id", id).maybeSingle();
    if (!mine) return NextResponse.json({ ok: false, message: "We can't find that order." }, { status: 404 });
  }
  const reason = (parsed.success ? parsed.data.reason : "") || (staff ? "Refunded by PowerProof" : "Refunded by the seller");
  if (staff && reason.length < 5) return NextResponse.json({ ok: false, message: "Add a reason for the refund." }, { status: 400 });
  try {
    await refundOrder(id, reason);
    if (staff) await sbAdmin().from("audit_log").insert({ actor_id: auth.user.id, action: "refund_order", target_type: "order", target_id: id, meta: { reason } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
    console.error("[refund]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "The refund didn't go through." }, { status: 500 });
  }
}
