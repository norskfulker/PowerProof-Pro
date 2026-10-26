import "server-only";
import { createElement } from "react";
import { AGENT_CODE } from "@/agents/server";
import { getManifest } from "@/agents/index";
import { cronEvery } from "@/lib/agents/define";
import { formatMoney } from "@/lib/money";
import { effectiveSchedule, nextRunAt, slotKey } from "@/lib/agents/schedule";
import { addDays, formatDayIN, istDay, istInstant, lastMondayNine } from "@/lib/agents/time";
import { siteUrl } from "@/lib/site-url";
import { TrialEndedEmail, WeeklyReportEmail } from "@/emails/agents/agent-emails";
import { agentsAdmin, must, storeDb } from "./db";
import { renderEmail, sendAgentMail } from "./mail";
import { businessName, loadStoreInfo, ownerEmail, platformSettings, productionPorts, type InstanceRow } from "./ports";
import { makeCtx } from "./runtime/context";
import { runLog, type RunLog } from "./run-log";
import { runSteps, type Checkpoints } from "./runtime/engine";
import type { ActionItemInput } from "./runtime/types";

/**
 * Runs one claimed job. Small and resumable: a run writes a checkpoint after each step, so the next
 * cron tick continues a run that ran out of time; every side effect is keyed, so a repeat is harmless.
 */

export interface Job {
  id: string;
  store_id: string;
  instance_id: string | null;
  kind: "run" | "dry_run" | "report" | "sheet_refresh" | "connection_alert";
  run_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
}

export type JobResult = { ok: true; note?: string } | { ok: false; error: string; retryInSeconds?: number };

const INSTANCE_COLS = "id, store_id, agent_id, status, settings, consent_at, run_every_minutes, next_run_at, paused_reason, schedule, report_frequency";

export async function loadInstance(id: string): Promise<InstanceRow | null> {
  const { data } = await agentsAdmin().from("agent_instances").select(INSTANCE_COLS).eq("id", id).maybeSingle();
  return (data as unknown as InstanceRow) ?? null;
}

/** A step's name as the owner reads it: the manifest's "How it works" title, else the step id */
const stepTitle = (agentId: string, step: string) => getManifest(agentId)?.howItWorks.find((h) => h.step === step)?.title ?? step.replace(/_/g, " ");

function checkpointsFor(runId: string, storeId: string, agentId: string, log: RunLog): Checkpoints {
  const sb = agentsAdmin();
  return {
    async started(step) {
      log.say("info", `→ ${stepTitle(agentId, step)}`, step);
    },
    async load() {
      const rows = must(await sb.from("agent_run_steps").select("step, output").eq("run_id", runId).eq("status", "done"), "read checkpoints") as { step: string; output: unknown }[];
      return Object.fromEntries(rows.map((r) => [r.step, r.output]));
    },
    async done(step, output) {
      must(await sb.from("agent_run_steps").upsert({ run_id: runId, store_id: storeId, step, status: "done", output, error: null, updated_at: new Date().toISOString() }), "save checkpoint");
    },
    async failed(step, error) {
      log.say("error", `✗ ${stepTitle(agentId, step)}: ${error}`, step);
      await sb.from("agent_run_steps").upsert({ run_id: runId, store_id: storeId, step, status: "failed", error, updated_at: new Date().toISOString() });
    },
  };
}

export interface RunResult {
  ok: boolean;
  runId: string;
  output?: Record<string, unknown>;
  preview?: ActionItemInput[];
  error?: string;
  retryable?: boolean;
  retryInSeconds?: number;
}

/** One run of one agent for one store. Dry runs send nothing and charge nothing. */
export async function runInstance(instance: InstanceRow, o: { trigger: "cron" | "manual" | "dry_run"; runId?: string | null; deadline: number; now?: Date }): Promise<RunResult> {
  const sb = agentsAdmin();
  const code = AGENT_CODE[instance.agent_id];
  if (!code) return { ok: false, runId: "", error: `No code for agent ${instance.agent_id}.` };
  const dryRun = o.trigger === "dry_run";
  const now = o.now ?? new Date();

  let runId = o.runId ?? null;
  if (!runId) {
    const row = must(await sb.from("agent_runs").insert({ store_id: instance.store_id, instance_id: instance.id, agent_id: instance.agent_id, trigger: o.trigger, dry_run: dryRun }).select("id").single(), "start run") as { id: string };
    runId = row.id;
  }

  const log = runLog({ storeId: instance.store_id, instanceId: instance.id, runId });
  const name = code.manifest.name;
  log.say("info", o.runId ? `${name}: carrying on where the last run stopped` : `${name}: ${TRIGGER_LINE[o.trigger]}`);

  const [store, settings] = await Promise.all([loadStoreInfo(instance.store_id), platformSettings()]);
  const provider = code.manifest.llm.provider === "anthropic" ? "anthropic" : settings.llm_provider;
  const preview: ActionItemInput[] = [];
  const ctx = makeCtx({
    code,
    instance: { id: instance.id, storeId: instance.store_id, status: instance.status, settings: instance.settings, consentAt: instance.consent_at },
    runId,
    dryRun,
    now,
    business: { name: businessName(store), supportEmail: store.support_email, country: store.country },
    ports: { ...productionPorts({ instance, store, llmProvider: provider, llmModel: code.manifest.llm.model }), say: (level, message) => log.say(level, message) },
    preview,
  });

  const out = await runSteps(code.manifest, code.steps, ctx, checkpointsFor(runId, instance.store_id, instance.agent_id, log), { deadline: o.deadline });
  if (!out.ok) {
    if (!out.retryable) await sb.from("agent_runs").update({ status: "failed", error: out.error.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", runId);
    log.say(out.retryable ? "warn" : "error", out.retryable ? "Paused mid-run; the next run picks it up from here." : "Stopped. Nothing more was sent in this run.");
    await log.flush();
    return { ok: false, runId, error: out.error, retryable: out.retryable, retryInSeconds: out.retryInSeconds };
  }
  const output = (out.output ?? {}) as Record<string, unknown>;
  // Previews are kept for dry runs only (they hold message text)
  const summary = dryRun ? { ...output, actions: preview.map((p) => ({ kind: p.kind, title: p.title })) } : { ...output, preview: undefined };
  await sb.from("agent_runs").update({ status: "succeeded", summary, finished_at: new Date().toISOString() }).eq("id", runId);
  log.say("ok", dryRun ? "✓ Preview ready. Nothing was sent or charged." : "✓ Done");
  await log.flush();
  if (!dryRun) {
    await sb.from("agent_instances").update({ last_run_at: now.toISOString() }).eq("id", instance.id);
    await afterRun(instance, output);
  }
  return { ok: true, runId, output, preview };
}

const TRIGGER_LINE: Record<"cron" | "manual" | "dry_run", string> = { cron: "scheduled run started", manual: "you started a run", dry_run: "free preview started (nothing is sent)" };

/** Out of credits: a trial ends, a paid agent pauses. Data is always kept. */
async function afterRun(instance: InstanceRow, output: Record<string, unknown>) {
  const sb = agentsAdmin();
  const counts = (output.counts ?? {}) as Record<string, number>;
  const balance = Number(must(await sb.rpc("agent_credit_balance", { p_store: instance.store_id }), "read credits"));
  if (balance > 0 && !counts.no_credits) return;
  if (instance.status === "trial") {
    const { data } = await sb.from("agent_instances").update({ status: "trial_ended", paused_reason: "credits_used", updated_at: new Date().toISOString() }).eq("id", instance.id).eq("status", "trial").select("id");
    if (data?.length) await trialEndedMail(instance);
  } else if (instance.status === "active" && counts.no_credits) {
    await sb.from("agent_instances").update({ status: "paused", paused_reason: "no_credits", updated_at: new Date().toISOString() }).eq("id", instance.id).eq("status", "active");
  }
}

async function trialEndedMail(instance: InstanceRow) {
  const m = getManifest(instance.agent_id);
  const store = await loadStoreInfo(instance.store_id);
  const to = await ownerEmail(store.owner_id);
  if (!m || !to) return;
  const { html, text } = await renderEmail(createElement(TrialEndedEmail, { storeName: businessName(store), agentName: m.name, credits: m.trial.credits, url: `${siteUrl()}/agents/my/${instance.id}` }));
  await sendAgentMail({ displayName: "PowerProof Agents", to, subject: `${m.name} has used its free credits`, html, text });
}

/** The report for the day or week that just ended. Recorded once per instance, period and start. */
export async function sendReport(instance: InstanceRow, periodStart: string, period: "day" | "week" = "week", now = new Date()): Promise<JobResult> {
  const sb = agentsAdmin();
  const code = AGENT_CODE[instance.agent_id];
  if (!code?.report) return { ok: true, note: "no report" };
  const daily = period === "day";
  const periodEnd = addDays(periodStart, daily ? 1 : 7);
  const { data: existing } = await sb.from("agent_reports").select("status").eq("instance_id", instance.id).eq("period", period).eq("period_start", periodStart).maybeSingle();
  if (existing?.status === "sent" || existing?.status === "skipped") return { ok: true, note: "already done" };

  const report = await code.report(storeDb(instance.store_id), { periodStart, periodEnd, now });
  const store = await loadStoreInfo(instance.store_id);
  const to = await ownerEmail(store.owner_id);
  const base = { store_id: instance.store_id, instance_id: instance.id, period, period_start: periodStart, period_end: periodEnd, data: report.data };
  const log = runLog({ storeId: instance.store_id, instanceId: instance.id, runId: null });
  if (report.empty || !to) {
    await sb.from("agent_reports").upsert({ ...base, status: "skipped", error: to ? "Nothing to report." : "No owner email." }, { onConflict: "instance_id,period,period_start" });
    log.say("info", `${code.manifest.name}: ${daily ? "daily" : "weekly"} report skipped (${to ? "nothing happened" : "no email to send it to"})`);
    await log.flush();
    return { ok: true, note: "skipped" };
  }
  const d = report.data as { overdueMinor: number; overdueCount: number; paidAfterReminderMinor: number; paidAfterReminderCount: number; sentByChannel: Record<string, number>; personalCalls: number; whatsappWaiting: number };
  const inr = (n: number) => formatMoney({ amount: n, currency: "INR" });
  const { html, text } = await renderEmail(
    createElement(WeeklyReportEmail, {
      storeName: businessName(store),
      agentName: code.manifest.name,
      week: daily ? formatDayIN(periodStart) : `${formatDayIN(periodStart)} – ${formatDayIN(addDays(periodEnd, -1))}`,
      daily,
      paidAfterReminder: inr(d.paidAfterReminderMinor),
      paidAfterReminderCount: d.paidAfterReminderCount,
      overdueNow: inr(d.overdueMinor),
      overdueCount: d.overdueCount,
      sent: [
        ["Emails sent", String(d.sentByChannel.email ?? 0)],
        ["WhatsApp sent", String(d.sentByChannel.whatsapp ?? 0)],
      ],
      personalCalls: d.personalCalls,
      whatsappWaiting: d.whatsappWaiting,
      dashboardUrl: `${siteUrl()}/agents/my/${instance.id}`,
    })
  );
  const sent = await sendAgentMail({ displayName: "PowerProof Agents", to, subject: report.subject, html, text });
  await sb.from("agent_reports").upsert({ ...base, status: sent.sent ? "sent" : "failed", sent_at: sent.sent ? new Date().toISOString() : null, error: sent.sent ? null : sent.reason }, { onConflict: "instance_id,period,period_start" });
  log.say(sent.sent ? "ok" : "warn", sent.sent ? `✓ ${daily ? "Daily" : "Weekly"} report emailed to you` : `${daily ? "Daily" : "Weekly"} report didn't send; trying again later`);
  await log.flush();
  return sent.sent ? { ok: true } : { ok: false, error: `Report email not sent (${sent.reason}).`, retryInSeconds: 1800 };
}

/** Adds the jobs that are due: hourly runs, Monday reports, daily sheet refreshes. Keys make repeats harmless. */
export async function enqueueDue(now = new Date()): Promise<number> {
  const sb = agentsAdmin();
  let added = 0;
  const due = (must(await sb.from("agent_instances").select(INSTANCE_COLS).in("status", ["trial", "active"]).lte("next_run_at", now.toISOString()).limit(500), "read due agents") ?? []) as unknown as InstanceRow[];
  const catalog = (must(await sb.from("agent_catalog").select("id, enabled"), "read catalog") as { id: string; enabled: boolean }[]).filter((c) => c.enabled).map((c) => c.id);
  for (const inst of due) {
    if (!catalog.includes(inst.agent_id)) continue;
    const m = getManifest(inst.agent_id);
    // The owner's schedule (every N minutes, or set times on chosen days), else the manifest's interval
    const s = effectiveSchedule(inst.schedule, inst.run_every_minutes ?? (m ? cronEvery(m) : null));
    if (!s) continue;
    const { data } = await sb.from("agent_jobs").upsert({ store_id: inst.store_id, instance_id: inst.id, kind: "run", run_at: now.toISOString(), idempotency_key: `run:${inst.id}:${slotKey(s, now)}` }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id");
    added += data?.length ?? 0;
    await sb.from("agent_instances").update({ next_run_at: nextRunAt(s, now).toISOString() }).eq("id", inst.id);
  }

  // Reports from 9:00 India time: every day for daily ones (yesterday), Mondays for weekly ones (last week)
  const nine = istInstant(istDay(now), 9);
  if (now.getTime() >= nine.getTime()) {
    const monday = lastMondayNine(now);
    const isMonday = now.getTime() - monday.getTime() < 24 * 3_600_000;
    const week = istDay(new Date(monday.getTime() - 7 * 86_400_000));
    const yesterday = addDays(istDay(now), -1);
    const withReports = (must(await sb.from("agent_instances").select("id, store_id, agent_id, report_frequency").in("status", ["trial", "active", "trial_ended", "paused"]).neq("report_frequency", "off").limit(5000), "read agents") ?? []) as { id: string; store_id: string; agent_id: string; report_frequency: string }[];
    const rows = withReports
      .filter((i) => getManifest(i.agent_id)?.report && (i.report_frequency === "daily" || isMonday))
      .map((i) => {
        const daily = i.report_frequency === "daily";
        const start = daily ? yesterday : week;
        return { store_id: i.store_id, instance_id: i.id, kind: "report", payload: { periodStart: start, period: daily ? "day" : "week" }, run_at: now.toISOString(), idempotency_key: `report:${daily ? "day" : "week"}:${i.id}:${start}` };
      });
    for (let i = 0; i < rows.length; i += 200) {
      const { data } = await sb.from("agent_jobs").upsert(rows.slice(i, i + 200), { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id");
      added += data?.length ?? 0;
    }
  }

  // Google Sheets refresh, once a day per connection
  const sheets = (must(await sb.from("agent_connections").select("id, store_id").eq("type", "google_sheets").eq("status", "connected").limit(5000), "read sheets") ?? []) as { id: string; store_id: string }[];
  const day = istDay(now);
  if (sheets.length) {
    const rows = sheets.map((c) => ({ store_id: c.store_id, instance_id: null, kind: "sheet_refresh", payload: { connectionId: c.id }, run_at: now.toISOString(), idempotency_key: `sheet:${c.id}:${day}` }));
    for (let i = 0; i < rows.length; i += 200) {
      const { data } = await sb.from("agent_jobs").upsert(rows.slice(i, i + 200), { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id");
      added += data?.length ?? 0;
    }
  }
  return added;
}
