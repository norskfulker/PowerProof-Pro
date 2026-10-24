import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, clientKey } from "@/lib/server/limit";
import { agentsAdmin } from "@/lib/server/agents/db";
import { addressHash, readOptOutToken } from "@/lib/server/agents/optout";

/**
 * A customer stops a store's reminders from the link in a message. The link is signed and names
 * the message, not the address. The opt-out covers that channel for that store, for every agent.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!allow(`optout:${clientKey(request)}`, 30, 3_600_000)) return NextResponse.json({ ok: false }, { status: 429 });
  const b = z.object({ token: z.string().max(200) }).safeParse(await request.json().catch(() => null));
  const outboxId = b.success ? readOptOutToken(b.data.token) : null;
  if (!outboxId) return NextResponse.json({ ok: false, message: "This link isn't valid." }, { status: 400 });
  const sb = agentsAdmin();
  const { data: m } = await sb.from("agent_messages_outbox").select("store_id, channel, to_address").eq("id", outboxId).maybeSingle();
  if (!m) return NextResponse.json({ ok: false, message: "This link isn't valid." }, { status: 400 });
  const channel = m.channel as "email" | "sms" | "whatsapp";
  await sb.from("agent_optouts").upsert({ store_id: m.store_id, channel, address_hash: addressHash(channel, String(m.to_address)), source: "link" }, { onConflict: "store_id,channel,address_hash", ignoreDuplicates: true });
  // Every send checks agent_optouts first; agents mark their own contact rows when a send is refused
  return NextResponse.json({ ok: true });
}
