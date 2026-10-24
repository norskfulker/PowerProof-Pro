import "server-only";
import { z } from "zod";
import { adminCatalog, adminDemand, adminMargin, adminOverview, adminRuns, adminStores, adminStoreView, adminSupport } from "@/lib/server/agents/admin";
import { AgentError, audit, fail, ok, requireAdmin } from "@/lib/server/agents/access";
import { agentsAdmin, must } from "@/lib/server/agents/db";

/**
 * PowerProof staff only (is_admin(), checked against the database on every call). GET ?view= reads
 * a screen; POST changes something, and every change is written to agent_audit_log.
 */
export const dynamic = "force-dynamic";

const VIEWS = { overview: adminOverview, demand: adminDemand, catalog: adminCatalog, runs: adminRuns, margin: adminMargin, support: adminSupport, stores: adminStores } as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "overview";
  try {
    const admin = await requireAdmin();
    if (view === "store") {
      const storeId = z.string().uuid().parse(url.searchParams.get("storeId"));
      // Read-only "see what they see" for support, logged every time
      await audit(admin.id, "agents_view_store", { type: "store", id: storeId });
      return ok({ data: await adminStoreView(storeId) });
    }
    const fn = VIEWS[view as keyof typeof VIEWS];
    if (!fn) throw new AgentError("Unknown view.", 404);
    return ok({ data: await fn() });
  } catch (e) {
    return fail(e, "admin");
  }
}

const agentId = z.string().regex(/^[a-z][a-z0-9-]{1,40}$/);
const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("switches"), runsEnabled: z.boolean().optional(), sendingEnabled: z.boolean().optional(), llmProvider: z.enum(["gemini", "anthropic"]).optional() }),
  z.object({ op: z.literal("agent_enabled"), agentId, enabled: z.boolean() }),
  z.object({ op: z.literal("catalog_save"), agentId, name: z.string().trim().min(1).max(80), tagline: z.string().trim().max(160), description: z.string().trim().max(2000), category: z.string().trim().min(1).max(40), status: z.enum(["live", "coming_soon", "hidden"]), sort: z.number().int().min(0).max(10000) }),
  z.object({ op: z.literal("instance_status"), instanceId: z.string().uuid(), suspend: z.boolean() }),
  z.object({ op: z.literal("grant_credits"), storeId: z.string().uuid(), credits: z.number().int().min(-10000).max(10000).refine((n) => n !== 0), reason: z.string().trim().min(3).max(200) }),
  z.object({ op: z.literal("retry_job"), jobId: z.string().uuid() }),
  z.object({ op: z.literal("close_support"), id: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return fail(new AgentError(b.error.issues[0]?.message ?? "That request wasn't right."), "admin");
  try {
    const admin = await requireAdmin();
    const sb = agentsAdmin();
    const d = b.data;
    const now = new Date().toISOString();
    switch (d.op) {
      case "switches": {
        const patch: Record<string, unknown> = { updated_at: now, updated_by: admin.id };
        if (d.runsEnabled !== undefined) patch.runs_enabled = d.runsEnabled;
        if (d.sendingEnabled !== undefined) patch.sending_enabled = d.sendingEnabled;
        if (d.llmProvider) patch.llm_provider = d.llmProvider;
        must(await sb.from("agent_platform_settings").update(patch).eq("id", true), "save switches");
        await audit(admin.id, "agents_switches", { type: "platform", id: "agents" }, patch);
        return ok();
      }
      case "agent_enabled":
        must(await sb.from("agent_catalog").update({ enabled: d.enabled, updated_at: now }).eq("id", d.agentId), "save agent");
        await audit(admin.id, d.enabled ? "agents_agent_on" : "agents_agent_off", { type: "agent", id: d.agentId });
        return ok();
      case "catalog_save": {
        const { op: _op, agentId: id, ...rest } = d;
        must(await sb.from("agent_catalog").upsert({ id, ...rest, updated_at: now }), "save catalog");
        await audit(admin.id, "agents_catalog_save", { type: "agent", id }, rest);
        return ok();
      }
      case "instance_status": {
        const { data: inst } = await sb.from("agent_instances").select("status, store_id").eq("id", d.instanceId).maybeSingle();
        if (!inst) throw new AgentError("Not found.", 404);
        const status = d.suspend ? "suspended" : "paused";
        must(await sb.from("agent_instances").update({ status, paused_reason: d.suspend ? "staff" : "owner", updated_at: now }).eq("id", d.instanceId), "save status");
        await audit(admin.id, d.suspend ? "agents_instance_suspend" : "agents_instance_unsuspend", { type: "agent_instance", id: d.instanceId }, { from: inst.status, store: inst.store_id });
        return ok();
      }
      case "grant_credits": {
        const key = `admin:${admin.id}:${d.storeId}:${now}`;
        must(await sb.from("agent_credit_ledger").insert({ store_id: d.storeId, delta: d.credits, kind: d.credits > 0 ? "admin_grant" : "admin_debit", reason: d.reason, idempotency_key: key, created_by: admin.id }), "grant credits");
        await audit(admin.id, "agents_credits", { type: "store", id: d.storeId }, { credits: d.credits, reason: d.reason });
        return ok();
      }
      case "retry_job":
        must(await sb.from("agent_jobs").update({ status: "queued", attempts: 0, run_at: now, last_error: null, updated_at: now }).eq("id", d.jobId).eq("status", "dead"), "retry job");
        await audit(admin.id, "agents_retry_job", { type: "agent_job", id: d.jobId });
        return ok();
      case "close_support":
        must(await sb.from("agent_support_items").update({ status: "closed", closed_at: now, closed_by: admin.id }).eq("id", d.id), "close item");
        await audit(admin.id, "agents_support_close", { type: "agent_support_item", id: d.id });
        return ok();
    }
  } catch (e) {
    return fail(e, "admin");
  }
}
