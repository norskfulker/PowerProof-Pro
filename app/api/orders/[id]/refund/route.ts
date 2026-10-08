import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CheckoutError } from "@/lib/server/checkout";
import { refundOrder } from "@/lib/server/shop";
import { sbServer } from "@/lib/supabase/server";

/** A creator refunds one of their own orders. Ownership is checked with their own session (row level security), then the money moves with the server key. */
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = z.object({ reason: z.string().trim().max(200).optional() }).safeParse(await request.json().catch(() => ({})));
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again to refund." }, { status: 401 });
  // creator_orders only holds this creator's orders
  const { data: mine } = await db.from("creator_orders").select("id").eq("id", id).maybeSingle();
  if (!mine) return NextResponse.json({ ok: false, message: "We can't find that order." }, { status: 404 });
  try {
    await refundOrder(id, parsed.success ? parsed.data.reason || "Refunded by the seller" : "Refunded by the seller");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
    console.error("[refund]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "The refund didn't go through." }, { status: 500 });
  }
}
