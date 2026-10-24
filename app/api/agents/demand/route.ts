import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, clientKey } from "@/lib/server/limit";
import { agentsAsUser } from "@/lib/server/agents/db";

/** "I need this" on a coming-soon agent. Open to anyone; rate limited; one request per email and agent. */
export const dynamic = "force-dynamic";

const body = z.object({
  agentId: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
  email: z.string().trim().email().max(200),
  mobile: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional(),
  storeId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  if (!allow(`demand:${clientKey(request)}`, 10, 3_600_000)) return NextResponse.json({ ok: false, message: "Too many requests. Try again in an hour." }, { status: 429 });
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return NextResponse.json({ ok: false, message: "Check your email (and mobile, with the country code)." }, { status: 400 });
  const sb = await agentsAsUser();
  const { error } = await sb.rpc("agent_request_demand", { p_agent: b.data.agentId, p_email: b.data.email, p_mobile: b.data.mobile || null, p_note: b.data.note || null, p_store: b.data.storeId ?? null });
  if (error) return NextResponse.json({ ok: false, message: error.message.includes("agent_not_found") ? "That agent wasn't found." : "We couldn't save that. Try again." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
