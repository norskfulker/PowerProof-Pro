import "server-only";
import { agentsAdmin, must } from "./db";
import { refreshSheet } from "./connectors/sheets";
import { enqueueDue, loadInstance, runInstance, sendWeeklyReport, type Job, type JobResult } from "./runner";

/**
 * The scheduler's worker side. The Worker's cron calls /api/cron/agents every 10 minutes: due jobs
 * are added (idempotent), then a bounded batch is claimed and run inside the time budget. Anything
 * unfinished is retried with backoff; after max_attempts a job is dead and shows in Admin.
 */

export async function runJob(job: Job, deadline: number, trigger: "cron" | "manual" = "cron"): Promise<JobResult> {
  const sb = agentsAdmin();
  try {
    if (job.kind === "run" || job.kind === "dry_run") {
      const inst = job.instance_id ? await loadInstance(job.instance_id) : null;
      if (!inst) return { ok: true, note: "agent removed" };
      if (job.kind === "run" && !["trial", "active"].includes(inst.status)) return { ok: true, note: `not running (${inst.status})` };
      const r = await runInstance(inst, { trigger: job.kind === "dry_run" ? "dry_run" : trigger, runId: job.run_id, deadline });
      if (r.runId && r.runId !== job.run_id) await sb.from("agent_jobs").update({ run_id: r.runId }).eq("id", job.id);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? "Run failed.", retryInSeconds: r.retryable ? (r.retryInSeconds ?? 300) : undefined };
    }
    if (job.kind === "report") {
      const inst = job.instance_id ? await loadInstance(job.instance_id) : null;
      if (!inst) return { ok: true, note: "agent removed" };
      return await sendWeeklyReport(inst, String(job.payload.periodStart));
    }
    if (job.kind === "sheet_refresh") return await refreshSheet(String(job.payload.connectionId));
    return { ok: true, note: "nothing to do" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "failed" };
  }
}

export async function finishJob(jobId: string, r: JobResult): Promise<string> {
  const sb = agentsAdmin();
  const status = must(await sb.rpc("agent_finish_job", { p_id: jobId, p_ok: r.ok, p_error: r.ok ? null : r.error, p_retry_seconds: r.ok ? null : (r.retryInSeconds ?? null) }), "finish job") as string;
  if (status === "dead") {
    // A run that gave up is marked dead too, for the failures list
    const { data } = await sb.from("agent_jobs").select("run_id").eq("id", jobId).maybeSingle();
    if (data?.run_id) await sb.from("agent_runs").update({ status: "dead", error: r.ok ? null : r.error, finished_at: new Date().toISOString() }).eq("id", data.run_id);
    console.error(JSON.stringify({ at: "agents", level: "error", message: "job dead", job: jobId }));
  }
  return status;
}

export async function tick(o: { budgetMs: number; batch: number; now?: Date }): Promise<{ enqueued: number; claimed: number; done: number; retried: number; dead: number }> {
  const started = Date.now();
  const deadline = started + o.budgetMs;
  const enqueued = await enqueueDue(o.now);
  const sb = agentsAdmin();
  const jobs = (must(await sb.rpc("agent_claim_jobs", { p_limit: o.batch, p_lease_seconds: Math.ceil(o.budgetMs / 1000) + 60 }), "claim jobs") ?? []) as Job[];
  const out = { enqueued, claimed: jobs.length, done: 0, retried: 0, dead: 0 };
  for (const job of jobs) {
    // Out of time: leave the rest; their lease runs out and the next tick takes them
    if (Date.now() > deadline) {
      out.retried++;
      continue;
    }
    const r = await runJob(job, deadline);
    const status = await finishJob(job.id, r);
    if (status === "done") out.done++;
    else if (status === "dead") out.dead++;
    else out.retried++;
  }
  return out;
}
