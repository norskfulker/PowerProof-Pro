import "server-only";
import { AGENT_CODE } from "@/agents/server";
import { getManifest } from "@/agents/index";
import { z } from "zod";
import { cronEvery, defaultSettings, settingsSchema } from "@/lib/agents/define";
import { effectiveSchedule, nextRunAt, replyRules, reportFrequencies, scheduleSchema } from "@/lib/agents/schedule";
import { AgentError } from "./access";
import { agentsAdmin, must } from "./db";
import { loadInstance, runInstance, type JobResult } from "./runner";
import { finishJob, runJob } from "./jobs";

/**
 * An agent's life in one store: set up (settings from the manifest, a free dry run), go live
 * (consent recorded, trial credits granted once), pause and resume, run now.
 */

const WORKER_BUDGET_MS = 25_000;

export async function createInstance(storeId: string, agentId: string, userId: string): Promise<string> {
  const m = getManifest(agentId);
  if (!m || m.status !== "live" || !AGENT_CODE[agentId]) throw new AgentError("That agent isn't available yet.", 404);
  const sb = agentsAdmin();
  const { data: cat } = await sb.from("agent_catalog").select("enabled, status").eq("id", agentId).maybeSingle();
  if (!cat || cat.status !== "live" || cat.enabled === false) throw new AgentError("That agent is switched off for now. Try again later.", 409);
  const { data: existing } = await sb.from("agent_instances").select("id").eq("store_id", storeId).eq("agent_id", agentId).maybeSingle();
  if (existing) return existing.id as string;
  const row = must(
    await sb
      .from("agent_instances")
      .upsert({ store_id: storeId, agent_id: agentId, status: "setup", settings: defaultSettings(m), run_every_minutes: cronEvery(m), created_by: userId }, { onConflict: "store_id,agent_id", ignoreDuplicates: true })
      .select("id"),
    "create agent"
  ) as { id: string }[];
  if (row[0]) return row[0].id;
  const again = must(await sb.from("agent_instances").select("id").eq("store_id", storeId).eq("agent_id", agentId).single(), "read agent") as { id: string };
  return again.id;
}

export async function saveSettings(instanceId: string, agentId: string, input: unknown): Promise<Record<string, unknown>> {
  const m = getManifest(agentId);
  if (!m) throw new AgentError("That agent isn't available.", 404);
  const parsed = settingsSchema(m).safeParse(input ?? {});
  if (!parsed.success) throw new AgentError(parsed.error.issues[0]?.message ?? "Check the settings.");
  must(await agentsAdmin().from("agent_instances").update({ settings: parsed.data, updated_at: new Date().toISOString() }).eq("id", instanceId), "save settings");
  return parsed.data;
}

/** The "see it before you pay" moment: exactly what would happen, nothing sent, nothing charged */
export async function dryRun(instanceId: string) {
  const inst = await loadInstance(instanceId);
  if (!inst) throw new AgentError("That agent wasn't found.", 404);
  const r = await runInstance(inst, { trigger: "dry_run", deadline: Date.now() + WORKER_BUDGET_MS });
  if (!r.ok) throw new AgentError(r.retryable ? "The preview took too long. Try again." : "The preview didn't work. Check your invoices and try again.", 502);
  return { runId: r.runId, output: r.output ?? {}, actions: (r.preview ?? []).map((p) => ({ kind: p.kind, title: p.title, body: p.body ?? null })) };
}

export async function activate(instanceId: string, agentId: string, storeId: string, userId: string, consent: boolean) {
  const m = getManifest(agentId);
  if (!m) throw new AgentError("That agent isn't available.", 404);
  if (!consent) throw new AgentError("Tick the box to confirm before switching it on.");
  const sb = agentsAdmin();
  const inst = await loadInstance(instanceId);
  if (!inst) throw new AgentError("That agent wasn't found.", 404);
  if (inst.status === "suspended") throw new AgentError("This agent was stopped by PowerProof. Write to support.", 409);
  const now = new Date().toISOString();
  // Trial credits once per store and agent, whatever happens later
  must(await sb.rpc("agent_grant_credits", { p_store: storeId, p_agent: agentId, p_n: m.trial.credits, p_kind: "trial_grant", p_key: `trial:${storeId}:${agentId}`, p_reason: "Free trial", p_by: userId }), "grant trial");
  for (const text of m.consents) must(await sb.from("agent_consents").insert({ store_id: storeId, instance_id: instanceId, user_id: userId, text }), "save consent");
  const balance = Number(must(await sb.rpc("agent_credit_balance", { p_store: storeId }), "read credits"));
  const { data: sub } = await sb.from("agent_subscriptions").select("status").eq("store_id", storeId).eq("agent_id", agentId).maybeSingle();
  const status = sub?.status === "active" ? "active" : balance > 0 ? "trial" : "trial_ended";
  must(await sb.from("agent_instances").update({ status, consent_at: now, consent_by: userId, paused_reason: status === "trial_ended" ? "credits_used" : null, next_run_at: now, updated_at: now }).eq("id", instanceId), "switch on");
  return { status, balance };
}

export async function setPaused(instanceId: string, paused: boolean) {
  const sb = agentsAdmin();
  const inst = await loadInstance(instanceId);
  if (!inst) throw new AgentError("That agent wasn't found.", 404);
  if (paused) {
    if (!["trial", "active"].includes(inst.status)) return inst.status;
    must(await sb.from("agent_instances").update({ status: "paused", paused_reason: "owner", updated_at: new Date().toISOString() }).eq("id", instanceId), "pause");
    return "paused";
  }
  if (inst.status !== "paused") return inst.status;
  if (inst.paused_reason === "connection") throw new AgentError("Fix the connection first; the agent switches back on by itself.", 409);
  const { data: sub } = await sb.from("agent_subscriptions").select("status").eq("store_id", inst.store_id).eq("agent_id", inst.agent_id).maybeSingle();
  const balance = Number(must(await sb.rpc("agent_credit_balance", { p_store: inst.store_id }), "read credits"));
  if (balance <= 0) throw new AgentError("No credits left, so it can't run yet.", 409);
  const status = sub?.status === "active" ? "active" : "trial";
  must(await sb.from("agent_instances").update({ status, paused_reason: null, next_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", instanceId), "resume");
  return status;
}

/** "Run now": a job like the hourly one, claimed straight away (same instance lock), run within this request */
export async function runNow(instanceId: string, storeId: string): Promise<JobResult & { runId?: string | null }> {
  const sb = agentsAdmin();
  const inst = await loadInstance(instanceId);
  if (!inst || !["trial", "active"].includes(inst.status)) throw new AgentError("Switch the agent on first.", 409);
  const minute = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const { data } = await sb.from("agent_jobs").upsert({ store_id: storeId, instance_id: instanceId, kind: "run", idempotency_key: `manual:${instanceId}:${minute}` }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id");
  const jobId = (data?.[0]?.id as string | undefined) ?? null;
  if (!jobId) throw new AgentError("It's already running. Give it a minute.", 409);
  const claimed = must(await sb.rpc("agent_claim_job", { p_id: jobId, p_lease_seconds: 120 }), "claim run") as { id: string }[];
  if (!claimed.length) return { ok: true, note: "It's already running; it will pick this up." };
  const job = must(await sb.from("agent_jobs").select("*").eq("id", jobId).single(), "read job");
  const result = await runJob(job as never, Date.now() + WORKER_BUDGET_MS, "manual");
  await finishJob(jobId, result);
  const { data: j } = await sb.from("agent_jobs").select("run_id").eq("id", jobId).maybeSingle();
  return { ...result, runId: (j?.run_id as string | null) ?? null };
}

const configInput = z.object({
  schedule: scheduleSchema.nullable().optional(),
  replyRule: z.enum(replyRules).optional(),
  replyPauseDays: z.number().int().min(1).max(60).optional(),
  reportFrequency: z.enum(reportFrequencies).optional(),
});

/** When it runs, what replies do and how often it reports. A new schedule takes effect from now. */
export async function configure(instanceId: string, input: unknown) {
  const p = configInput.safeParse(input);
  if (!p.success) throw new AgentError(p.error.issues[0]?.message ?? "Check the schedule.");
  const inst = await loadInstance(instanceId);
  if (!inst) throw new AgentError("That agent wasn't found.", 404);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.data.schedule !== undefined) {
    const m = getManifest(inst.agent_id);
    const s = effectiveSchedule(p.data.schedule, m ? cronEvery(m) : null);
    patch.schedule = p.data.schedule;
    patch.next_run_at = s ? nextRunAt(s, new Date()).toISOString() : null;
  }
  if (p.data.replyRule) patch.reply_rule = p.data.replyRule;
  if (p.data.replyPauseDays) patch.reply_pause_days = p.data.replyPauseDays;
  if (p.data.reportFrequency) patch.report_frequency = p.data.reportFrequency;
  must(await agentsAdmin().from("agent_instances").update(patch).eq("id", instanceId), "save schedule");
  return { nextRunAt: (patch.next_run_at as string | null | undefined) ?? inst.next_run_at };
}
