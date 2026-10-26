import "server-only";
import { AGENT_CODE } from "@/agents/server";
import { getManifest } from "@/agents/index";
import { classifyReply, decideReply, INTENT_LABEL, type ReplyIntent } from "@/lib/agents/replies";
import type { ReplyRule } from "@/lib/agents/schedule";
import { formatDayIN, istDay } from "@/lib/agents/time";
import { AgentError } from "./access";
import { agentsAdmin, must, storeDb } from "./db";
import { replyText } from "./reply-address";
import { runLog } from "./run-log";

export { readReplyAddress, replyAddress, replyText } from "./reply-address";

/**
 * Customer replies. A reply comes in by email (Resend inbound, to the reply address on each
 * reminder) or the owner marks one (a WhatsApp reply, a phone call). Either way it's read with plain
 * rules (lib/agents/replies.ts), the instance's reply rule decides what happens, the agent applies
 * it to its own data, and the owner sees it in the terminal, the Replies tab and, when it needs a
 * look, their queue.
 */

/* Recording and applying ------------------------------------------------------------------------ */

export interface ReplyIn {
  outboxId: string;
  source: "inbound" | "owner";
  text: string;
  /** The owner can say what it meant instead of us reading it */
  intent?: ReplyIntent;
  promisedOn?: string | null;
  providerMessageId?: string;
  /** The owner marked it from this agent's page: the message must be this agent's */
  instanceId?: string;
  now?: Date;
}

export interface ReplyOut {
  id: string;
  intent: ReplyIntent;
  applied: string;
  duplicate?: boolean;
}

export async function recordReply(r: ReplyIn): Promise<ReplyOut> {
  const sb = agentsAdmin();
  const now = r.now ?? new Date();
  const today = istDay(now);
  const msg = must(await sb.from("agent_messages_outbox").select("id, store_id, instance_id, agent_id, channel, contact_key").eq("id", r.outboxId).maybeSingle(), "read message") as {
    id: string;
    store_id: string;
    instance_id: string;
    agent_id: string;
    channel: "email" | "whatsapp" | "sms";
    contact_key: string;
  } | null;
  if (!msg || (r.instanceId && msg.instance_id !== r.instanceId)) throw new AgentError("That message wasn't found.", 404);
  if (r.providerMessageId) {
    const { data: seen } = await sb.from("agent_replies").select("id, intent, applied").eq("provider_message_id", r.providerMessageId).maybeSingle();
    if (seen) return { id: seen.id as string, intent: seen.intent as ReplyIntent, applied: seen.applied as string, duplicate: true };
  }
  const inst = must(await sb.from("agent_instances").select("reply_rule, reply_pause_days").eq("id", msg.instance_id).single(), "read agent") as { reply_rule: ReplyRule; reply_pause_days: number };

  const excerpt = replyText(r.text);
  const read = r.intent ? { intent: r.intent, promisedOn: r.promisedOn ?? null } : classifyReply(excerpt, today);
  const decision = decideReply(inst.reply_rule, read.intent, { promisedOn: read.promisedOn, pauseDays: inst.reply_pause_days, today });

  const row = must(
    await sb
      .from("agent_replies")
      .insert({ store_id: msg.store_id, instance_id: msg.instance_id, outbox_id: msg.id, contact_key: msg.contact_key, channel: msg.channel, source: r.source, excerpt, intent: read.intent, promised_on: read.promisedOn, applied: decision.applied, provider_message_id: r.providerMessageId ?? null, received_at: now.toISOString() })
      .select("id")
      .single(),
    "save reply"
  ) as { id: string };

  // The agent applies it to its own data (Payment Chaser: pause or snooze that customer)
  const hook = AGENT_CODE[msg.agent_id]?.onReply;
  if (hook) await hook(storeDb(msg.store_id), { contactKey: msg.contact_key, decision: decision.action, until: decision.action === "snooze" ? decision.until : null }, now);

  if (decision.review) {
    await sb.from("agent_action_items").upsert(
      {
        store_id: msg.store_id,
        instance_id: msg.instance_id,
        kind: "review_reply",
        title: `${INTENT_LABEL[read.intent]}: a customer replied`,
        body: excerpt || null,
        payload: { replyId: row.id, outboxId: msg.id, intent: read.intent },
        ref_type: "agent_reply",
        ref_id: row.id,
        idempotency_key: `reply:${row.id}`,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true }
    );
  }

  const name = getManifest(msg.agent_id)?.name ?? "Agent";
  const what = decision.action === "stop" ? "stopped reminders to them" : decision.action === "snooze" ? `waiting until ${formatDayIN(decision.until)}` : "carrying on";
  const log = runLog({ storeId: msg.store_id, instanceId: msg.instance_id, runId: null });
  log.say(decision.review ? "warn" : "info", `${name}: ${r.source === "owner" ? "you marked a reply" : `${msg.channel} reply`} (${INTENT_LABEL[read.intent].toLowerCase()}): ${what}${decision.review ? ". It's in your queue to check." : ""}`);
  await log.flush();
  return { id: row.id, intent: read.intent, applied: decision.applied };
}
