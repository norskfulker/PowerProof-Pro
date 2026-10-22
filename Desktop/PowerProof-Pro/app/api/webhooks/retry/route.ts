import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentAdmin } from "@/lib/server/admin-auth";
import { handleEvent, type GatewayEvent } from "@/lib/server/razorpay-events";
import { sbAdmin } from "@/lib/supabase/admin";

/** Staff run a webhook event that failed once more. Handling is safe to repeat. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false, message: "Only PowerProof staff can do that." }, { status: 403 });
  const parsed = z.object({ id: z.number().int().positive() }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Pick an event to retry." }, { status: 400 });
  const db = sbAdmin();
  const { data: row } = await db.from("webhook_events").select("id, payload, event_type").eq("id", parsed.data.id).maybeSingle();
  if (!row) return NextResponse.json({ ok: false, message: "That event no longer exists." }, { status: 404 });
  try {
    await handleEvent(row.payload as unknown as GatewayEvent);
    await db.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", row.id);
    await db.from("audit_log").insert({ actor_id: admin.id, action: "webhook_retried", target_type: "webhook", target_id: String(row.id), meta: { event: row.event_type } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 300) : "failed";
    await db.from("webhook_events").update({ error: message }).eq("id", row.id);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
