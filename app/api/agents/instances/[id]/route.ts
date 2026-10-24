import "server-only";
import { z } from "zod";
import { AGENT_CODE } from "@/agents/server";
import { AgentError, fail, ok, requireInstance } from "@/lib/server/agents/access";
import { agentsAdmin } from "@/lib/server/agents/db";
import { storeDb } from "@/lib/server/agents/db";
import { activate, dryRun, runNow, saveSettings, setPaused } from "@/lib/server/agents/instances";
import { sendTestEmail } from "@/lib/server/agents/test-email";

/**
 * One agent in one store. GET: its headline numbers. PATCH: settings (checked against the
 * manifest). POST op: dry_run (free preview), activate (consent + go live), pause, resume, run,
 * test_email (the owner gets a real reminder at their own address), link.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const id = z.string().uuid();

export async function GET(_request: Request, { params }: Params) {
  const p = id.safeParse((await params).id);
  if (!p.success) return fail(new AgentError("That agent wasn't found.", 404), "instance");
  try {
    const { storeId, agentId } = await requireInstance(p.data);
    const code = AGENT_CODE[agentId];
    return ok({ metrics: code?.metrics ? await code.metrics(storeDb(storeId), { now: new Date() }) : {} });
  } catch (e) {
    return fail(e, "instance");
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const p = id.safeParse((await params).id);
  const b = z.object({ settings: z.record(z.string(), z.unknown()) }).safeParse(await request.json().catch(() => null));
  if (!p.success || !b.success) return fail(new AgentError("That request wasn't right."), "instance");
  try {
    const { agentId } = await requireInstance(p.data);
    return ok({ settings: await saveSettings(p.data, agentId, b.data.settings) });
  } catch (e) {
    return fail(e, "instance");
  }
}

const op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("dry_run") }),
  z.object({ op: z.literal("activate"), consent: z.boolean() }),
  z.object({ op: z.literal("pause") }),
  z.object({ op: z.literal("resume") }),
  z.object({ op: z.literal("run") }),
  z.object({ op: z.literal("test_email") }),
  z.object({ op: z.literal("link"), connectorKey: z.string().min(1).max(40), connectionId: z.string().uuid() }),
]);

export async function POST(request: Request, { params }: Params) {
  const p = id.safeParse((await params).id);
  const b = op.safeParse(await request.json().catch(() => null));
  if (!p.success || !b.success) return fail(new AgentError("That request wasn't right."), "instance");
  try {
    const { user, storeId, agentId } = await requireInstance(p.data);
    switch (b.data.op) {
      case "dry_run":
        return ok(await dryRun(p.data));
      case "activate":
        return ok(await activate(p.data, agentId, storeId, user.id, b.data.consent));
      case "pause":
        return ok({ status: await setPaused(p.data, true) });
      case "resume":
        return ok({ status: await setPaused(p.data, false) });
      case "run":
        return ok(await runNow(p.data, storeId));
      case "test_email":
        return ok(await sendTestEmail({ instanceId: p.data, storeId, agentId, user }));
      case "link": {
        const sb = agentsAdmin();
        const { data: conn } = await sb.from("agent_connections").select("id, store_id").eq("id", b.data.connectionId).maybeSingle();
        if (!conn || conn.store_id !== storeId) throw new AgentError("That connection wasn't found.", 404);
        await sb.from("agent_instance_connections").upsert({ instance_id: p.data, connector_key: b.data.connectorKey, connection_id: conn.id, store_id: storeId });
        return ok();
      }
    }
  } catch (e) {
    return fail(e, "instance");
  }
}
