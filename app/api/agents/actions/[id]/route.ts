import "server-only";
import { z } from "zod";
import { AGENT_CODE } from "@/agents/server";
import { AgentError, fail, ok, requireStoreAgents } from "@/lib/server/agents/access";
import { agentsAdmin, must, storeDb } from "@/lib/server/agents/db";

/**
 * The owner's one-tap queue. done: they sent the WhatsApp message (or made the call); skip: not
 * this one (its credit is given back); snooze: ask again later.
 */
export const dynamic = "force-dynamic";

const body = z.object({ action: z.enum(["done", "skip", "snooze"]), hours: z.number().int().min(1).max(168).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  const b = body.safeParse(await request.json().catch(() => null));
  if (!id.success || !b.success) return fail(new AgentError("That request wasn't right."), "actions");
  try {
    const sb = agentsAdmin();
    const item = must(await sb.from("agent_action_items").select("id, store_id, instance_id, kind, status, payload, ref_type, ref_id").eq("id", id.data).maybeSingle(), "read item") as {
      id: string;
      store_id: string;
      instance_id: string;
      kind: string;
      status: string;
      payload: Record<string, unknown>;
      ref_type: string | null;
      ref_id: string | null;
    } | null;
    if (!item) throw new AgentError("That item wasn't found.", 404);
    const user = await requireStoreAgents(item.store_id);
    if (item.status === "done" || item.status === "skipped") return ok({ status: item.status });
    const now = new Date();

    if (b.data.action === "snooze") {
      await sb.from("agent_action_items").update({ status: "snoozed", snooze_until: new Date(now.getTime() + (b.data.hours ?? 24) * 3_600_000).toISOString() }).eq("id", item.id);
      return ok({ status: "snoozed" });
    }
    const outcome = b.data.action === "done" ? "done" : "skipped";
    const { data: changed } = await sb.from("agent_action_items").update({ status: outcome, done_at: now.toISOString(), done_by: user.id }).eq("id", item.id).in("status", ["open", "snoozed"]).select("id");
    if (!changed?.length) return ok({ status: outcome });
    const outboxId = typeof item.payload.outboxId === "string" ? item.payload.outboxId : null;
    if (outboxId) {
      // A WhatsApp message: sent by the owner, or skipped (its credit comes back)
      if (outcome === "done") await sb.from("agent_messages_outbox").update({ status: "sent", sent_at: now.toISOString() }).eq("id", outboxId).eq("store_id", item.store_id);
      else await sb.rpc("agent_outbox_finish", { p_id: outboxId, p_status: "failed", p_error: "Skipped by the owner." });
    }
    const { data: inst } = await sb.from("agent_instances").select("agent_id").eq("id", item.instance_id).maybeSingle();
    const hook = AGENT_CODE[String(inst?.agent_id)]?.onAction;
    if (hook) await hook(storeDb(item.store_id), { kind: item.kind, refType: item.ref_type, refId: item.ref_id, payload: item.payload }, outcome, now);
    return ok({ status: outcome });
  } catch (e) {
    return fail(e, "actions");
  }
}
