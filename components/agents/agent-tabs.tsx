"use client";

import { useState } from "react";
import { MessageSquareReply, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { BoxTable, useViewMode, ViewToggle, type Column } from "@/components/pp/box-table";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { Segmented } from "@/components/pp/segmented";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { cronEvery, type AgentManifest } from "@/lib/agents/define";
import { appliedLabel, INTENT_LABEL, type ReplyIntent } from "@/lib/agents/replies";
import { describeSchedule, effectiveSchedule, REPLY_RULES, REPORT_FREQUENCY, scheduleSchema, WEEKDAYS, type ReplyRule, type ReportFrequency, type Schedule } from "@/lib/agents/schedule";
import { formatDayIN } from "@/lib/agents/time";
import { configureAgent, getReplies, getReports, getRuns, getSentMessages, markReply, type AgentInstance, type AgentReply, type AgentReport, type AgentRun } from "@/lib/api/agents";
import { formatDate, timeAgo } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { nextRunLabel } from "./bits";

/* Activity ------------------------------------------------------------------------------------- */

const TRIGGER: Record<AgentRun["trigger"], string> = { cron: "On schedule", manual: "You ran it", dry_run: "Free preview" };

export function ActivityTab({ instanceId, runLine }: { instanceId: string; runLine: (r: AgentRun) => string }) {
  const { data, loading, error, reload } = useApi(() => getRuns(instanceId), [instanceId], { live: true });
  const [mode, setMode] = useViewMode("agent-activity", "table");
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-48 rounded-card" />;
  if (!data.length) return <EmptyState compact title="No runs yet" />;
  const columns: Column<AgentRun>[] = [
    { key: "when", label: "When", cell: (r) => formatDate(r.startedAt, { time: true }) },
    { key: "how", label: "Started by", cell: (r) => TRIGGER[r.trigger] },
    { key: "what", label: "What happened", cell: (r) => runLine(r) },
    { key: "status", label: "Result", cell: (r) => (r.status === "failed" || r.status === "dead" ? <StatusPill status="failed" label="Didn't finish" /> : r.status === "running" ? <StatusPill status="running" label="Running" tone="info" /> : <StatusPill status="succeeded" label="Done" tone="success" />) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <ViewToggle value={mode} onChange={setMode} className="self-end" />
      <BoxTable label="Runs" mode={mode} rows={data} columns={columns} rowKey={(r) => r.id} />
    </div>
  );
}

/* Replies -------------------------------------------------------------------------------------- */

const CHANNEL = { email: "Email", whatsapp: "WhatsApp", sms: "SMS" } as const;
const INTENTS: ReplyIntent[] = ["paid", "promise", "dispute", "stop", "other"];

export function RepliesTab({ instance }: { instance: AgentInstance }) {
  const { data, loading, error, reload } = useApi(() => getReplies(instance.id), [instance.id], { live: true });
  const [mode, setMode] = useViewMode("agent-replies", "table");
  const [marking, setMarking] = useState(false);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const columns: Column<AgentReply>[] = [
    { key: "when", label: "When", cell: (r) => timeAgo(r.receivedAt) },
    { key: "who", label: "From", cell: (r) => <span className="break-all">{r.to ?? "—"}</span> },
    { key: "how", label: "By", cell: (r) => `${CHANNEL[r.channel]}${r.source === "owner" ? " (marked)" : ""}` },
    { key: "meant", label: "Meaning", cell: (r) => INTENT_LABEL[r.intent] + (r.promisedOn ? ` · ${formatDayIN(r.promisedOn)}` : "") },
    { key: "did", label: "What the agent did", cell: (r) => appliedLabel(r.applied, formatDayIN) },
    { key: "said", label: "Said", tableOnly: false, cell: (r) => <span className="line-clamp-2 text-muted-foreground">{r.excerpt || "—"}</span> },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => setMarking(true)}>
          <MessageSquareReply aria-hidden /> Mark a reply
        </Button>
        <ViewToggle value={mode} onChange={setMode} />
      </div>
      {loading || !data ? <Skeleton className="h-40 rounded-card" /> : data.length ? <BoxTable label="Replies" mode={mode} rows={data} columns={columns} rowKey={(r) => r.id} /> : <EmptyState compact icon={MessageSquareReply} title="No replies yet" />}
      <MarkReply instanceId={instance.id} open={marking} onOpenChange={setMarking} />
    </div>
  );
}

/** The owner marks a reply that came another way (WhatsApp, a call): to one message the agent sent */
export function MarkReply({ instanceId, open, onOpenChange, outboxId }: { instanceId: string; open: boolean; onOpenChange: (o: boolean) => void; outboxId?: string }) {
  const sent = useApi(() => (open && !outboxId ? getSentMessages(instanceId) : Promise.resolve([])), [instanceId, open, outboxId ?? ""]);
  const [pick, setPick] = useState("");
  const [text, setText] = useState("");
  const [intent, setIntent] = useState<"read" | ReplyIntent>("read");
  const [on, setOn] = useState("");
  const [busy, setBusy] = useState(false);
  const target = outboxId ?? pick;
  const save = async () => {
    setBusy(true);
    try {
      const r = await markReply(instanceId, { outboxId: target, text, intent: intent === "read" ? undefined : intent, promisedOn: intent === "promise" && on ? on : undefined });
      toast.success(`Logged: ${INTENT_LABEL[r.intent as ReplyIntent] ?? "reply"}. ${appliedLabel(r.applied, formatDayIN)}.`);
      setText("");
      setPick("");
      setIntent("read");
      setOn("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Mark a reply</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {!outboxId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mr-msg">Reply to</Label>
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger id="mr-msg">
                  <SelectValue placeholder={sent.loading ? "Loading…" : sent.data?.length ? "Pick a message" : "Nothing sent yet"} />
                </SelectTrigger>
                <SelectContent>
                  {(sent.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {CHANNEL[m.channel]} · {m.to} · {formatDate(m.createdAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mr-text">What they said</Label>
            <Textarea id="mr-text" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Will pay by Friday" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mr-intent">Meaning</Label>
            <Select value={intent} onValueChange={(v) => setIntent(v as typeof intent)}>
              <SelectTrigger id="mr-intent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Work it out from what they said</SelectItem>
                {INTENTS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {INTENT_LABEL[i]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {intent === "promise" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mr-on">Pay date</Label>
              <Input id="mr-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !target || (intent === "read" && !text.trim())} onClick={save}>
            Save reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Reports -------------------------------------------------------------------------------------- */

/** "paidAfterReminderMinor" → "Paid after reminder" (money); counts as they are */
const words = (k: string) => {
  const w = k.replace(/Minor$/, "").replace(/([A-Z])/g, " $1").toLowerCase().trim();
  return w[0].toUpperCase() + w.slice(1);
};

export function ReportsTab({ instance }: { instance: AgentInstance }) {
  const { data, loading, error, reload } = useApi(() => getReports(instance.id), [instance.id], { live: true });
  const [mode, setMode] = useViewMode("agent-reports", "table");
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-40 rounded-card" />;
  const numbers = [...new Set(data.flatMap((r) => Object.entries(r.data).filter(([k, v]) => typeof v === "number" && !/count$/i.test(k)).map(([k]) => k)))].slice(0, 4);
  const columns: Column<AgentReport>[] = [
    { key: "period", label: "Period", cell: (r) => (r.period === "day" ? formatDayIN(r.periodStart) : `Week of ${formatDayIN(r.periodStart)}`) },
    ...numbers.map((k) => ({ key: k, label: words(k), numeric: true, cell: (r: AgentReport) => (typeof r.data[k] === "number" ? (k.endsWith("Minor") ? formatMoney({ amount: r.data[k] as number, currency: "INR" }) : (r.data[k] as number).toLocaleString("en-IN")) : "—") })),
    { key: "status", label: "Email", cell: (r) => <StatusPill status={r.status} label={r.status === "sent" ? "Sent" : r.status === "skipped" ? "Nothing to report" : r.status === "failed" ? "Didn't send" : "Waiting"} tone={r.status === "sent" ? "success" : r.status === "failed" ? "danger" : "neutral"} /> },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{REPORT_FREQUENCY[instance.reportFrequency]}</p>
        <ViewToggle value={mode} onChange={setMode} />
      </div>
      {data.length ? <BoxTable label="Reports" mode={mode} rows={data} columns={columns} rowKey={(r) => r.id} /> : <EmptyState compact title="No reports yet" />}
    </div>
  );
}

/* Schedule, replies and report ----------------------------------------------------------------- */

const INTERVALS = [30, 60, 120, 180, 360, 720, 1440];

export function ScheduleTab({ instance, manifest }: { instance: AgentInstance; manifest: AgentManifest }) {
  const base = effectiveSchedule(instance.schedule, cronEvery(manifest)) ?? { mode: "interval", everyMinutes: 60 };
  const [s, setS] = useState<Schedule>(base);
  const [rule, setRule] = useState<ReplyRule>(instance.replyRule);
  const [pauseDays, setPauseDays] = useState(instance.replyPauseDays);
  const [report, setReport] = useState<ReportFrequency>(instance.reportFrequency);
  const [busy, setBusy] = useState(false);
  const parsed = scheduleSchema.safeParse(s);

  const save = async () => {
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Check the schedule.");
    setBusy(true);
    try {
      const r = await configureAgent(instance.id, { schedule: parsed.data, replyRule: rule, replyPauseDays: pauseDays, reportFrequency: report });
      toast.success(r.nextRunAt ? `Saved. ${nextRunLabel({ status: instance.status, nextRunAt: r.nextRunAt })}.` : "Saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-lg">When it runs</legend>
        <Segmented
          label="Run by"
          value={s.mode}
          onChange={(m) => setS(m === "interval" ? { mode: "interval", everyMinutes: 60 } : { mode: "times", times: ["09:00"], days: [1, 2, 3, 4, 5] })}
          options={[
            { value: "interval", label: "Every few hours" },
            { value: "times", label: "At set times" },
          ]}
        />
        {s.mode === "interval" ? (
          <Select value={String(s.everyMinutes)} onValueChange={(v) => setS({ mode: "interval", everyMinutes: Number(v) })}>
            <SelectTrigger className="w-56" aria-label="How often">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {describeSchedule({ mode: "interval", everyMinutes: n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {s.times.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <Input type="time" aria-label={`Time ${i + 1}`} className="w-32" value={t} onChange={(e) => setS({ ...s, times: s.times.map((x, j) => (j === i ? e.target.value : x)) })} />
                  {s.times.length > 1 && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${t}`} onClick={() => setS({ ...s, times: s.times.filter((_, j) => j !== i) })}>
                      <X aria-hidden />
                    </Button>
                  )}
                </span>
              ))}
              {s.times.length < 6 && (
                <Button variant="secondary" size="sm" onClick={() => setS({ ...s, times: [...s.times, "17:00"] })}>
                  <Plus aria-hidden /> Add a time
                </Button>
              )}
            </div>
            <div role="group" aria-label="Days" className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(([n, label]) => {
                const on = s.days.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setS({ ...s, days: on ? s.days.filter((d) => d !== n) : [...s.days, n] })}
                    className={cn("min-h-9 min-w-12 rounded-full border px-3 text-sm font-semibold pointer-coarse:min-h-11", on ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <p className="text-sm text-muted-foreground">{parsed.success ? `${describeSchedule(parsed.data)}, India time. It runs on its own; you don't need to be here.` : parsed.error.issues[0]?.message}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-display text-lg">When a customer replies</legend>
        {(Object.keys(REPLY_RULES) as ReplyRule[]).map((r) => (
          <label key={r} className={cn("flex cursor-pointer items-start gap-3 rounded-card border p-3.5", rule === r ? "border-primary bg-primary-soft/40" : "hover:border-primary/40")}>
            <input type="radio" name="reply-rule" className="mt-1 accent-[var(--primary)]" checked={rule === r} onChange={() => setRule(r)} />
            <span>
              <span className="block font-semibold">{REPLY_RULES[r].label}</span>
              <span className="block text-sm text-muted-foreground">{REPLY_RULES[r].short}</span>
            </span>
          </label>
        ))}
        {(rule === "pause" || rule === "auto") && (
          <label className="mt-1 flex items-center gap-2 text-sm">
            Wait
            <Input type="number" min={1} max={60} className="w-20" value={pauseDays} onChange={(e) => setPauseDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
            days after a reply{rule === "auto" ? " that doesn't name a pay date" : ""}
          </label>
        )}
        <p className="text-sm text-muted-foreground">Asked to stop? It always stops, whatever you pick.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-lg">Report to you</legend>
        <Segmented
          label="Report"
          value={report}
          onChange={setReport}
          options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "off", label: "Off" },
          ]}
        />
        <p className="text-sm text-muted-foreground">{REPORT_FREQUENCY[report]}{report !== "off" ? ", by email, and kept under Reports." : "."}</p>
      </fieldset>

      <Button size="lg" className="self-start" disabled={busy || !parsed.success} onClick={save}>
        Save
      </Button>
    </div>
  );
}
