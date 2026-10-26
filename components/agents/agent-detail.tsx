"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Eye, Mail, MessageCircle, Pause, Play, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AGENT_UI } from "@/agents/ui";
import { getManifest } from "@/agents/index";
import { ErrorState, EmptyState } from "@/components/pp/empty-state";
import { BoxTable, useViewMode, ViewToggle } from "@/components/pp/box-table";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { agentOp, currentStoreId, getCredits, getInstance, getMetrics, reportProblem, saveAgentSettings, type AgentInstance, type AgentRun } from "@/lib/api/agents";
import { CREDIT_PRICE, cronEvery, type AgentManifest } from "@/lib/agents/define";
import { describeSchedule, effectiveSchedule, REPLY_RULES, REPORT_FREQUENCY } from "@/lib/agents/schedule";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AgentStatus, ExplainedNumber, nextRunLabel, PAUSED_WHY, supportWhatsApp } from "./bits";
import { ActivityTab, RepliesTab, ReportsTab, ScheduleTab } from "./agent-tabs";
import { CategoryIcon, toneFor } from "./catalog";
import { AgentTerminal, TerminalButton } from "./terminal";
import { BuyCredits, CREDIT_RULE } from "./buy-credits";
import { SettingsFields } from "./settings-form";

type Tab = "terminal" | "overview" | "activity" | "replies" | "reports" | "schedule" | "settings" | "usage" | "help";
const TABS: { id: Tab; label: string }[] = [
  { id: "terminal", label: "Terminal" },
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "replies", label: "Replies" },
  { id: "reports", label: "Reports" },
  { id: "schedule", label: "Schedule" },
  { id: "settings", label: "Settings" },
  { id: "usage", label: "Credits" },
  { id: "help", label: "Help" },
];

/**
 * One agent's page. It opens on the terminal: the agent's real work, live. Then Overview, Activity,
 * Replies, Reports, Schedule (when it runs, what replies do, the report), Settings, Credits, Help (?tab=).
 */
export function AgentDetail({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const asked = useSearchParams().get("tab") as Tab | null;
  const tab: Tab = asked && TABS.some((t) => t.id === asked) ? asked : "terminal";
  const { data: instance, loading, error, reload } = useApi(() => getInstance(instanceId), [instanceId], { live: true });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !instance) return <Skeleton className="h-96 rounded-card" />;
  const m = getManifest(instance.agentId);
  if (!m) return <EmptyState title="This agent isn't available any more." />;
  if (instance.status === "setup")
    return (
      <EmptyState
        title={`${m.name} isn't switched on yet`}
        body="Finish setting it up. The preview is free."
        action={
          <Button asChild>
            <Link href={`/agents/my/${instance.id}/setup`}>Continue setup</Link>
          </Button>
        }
      />
    );
  const ui = AGENT_UI[instance.agentId] ?? {};
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-control text-white" style={{ background: `linear-gradient(135deg, ${toneFor(m.category)}, color-mix(in oklab, ${toneFor(m.category)} 55%, black))` }}>
              <CategoryIcon category={m.category} className="size-5" />
            </span>
            {m.name}
          </span>
        }
        back={{ href: "/marketplace?tab=subscribed", label: "Subscribed agents" }}
        actions={<RunControls instance={instance} />}
      />
      <StatusBanner instance={instance} manifest={m} />
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4" aria-label={`${m.name} sections`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => router.replace(`/agents/my/${instance.id}${t.id === "terminal" ? "" : `?tab=${t.id}`}`, { scroll: false })}
            className={cn("min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold transition-colors", tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "terminal" && <TerminalTab instance={instance} manifest={m} />}
      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          {ui.Overview ? <ui.Overview instance={instance} /> : <GenericOverview instance={instance} manifest={m} />}
          {ui.links && (
            <div className="flex flex-wrap gap-2">
              {ui.links.map((l) => (
                <Button key={l.view} asChild variant="secondary">
                  <Link href={`/agents/my/${instance.id}/${l.view}`}>{l.label}</Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === "activity" && <ActivityTab instanceId={instance.id} runLine={runLine} />}
      {tab === "replies" && <RepliesTab instance={instance} />}
      {tab === "reports" && <ReportsTab instance={instance} />}
      {tab === "schedule" && <ScheduleTab instance={instance} manifest={m} />}
      {tab === "settings" && <SettingsTab instance={instance} manifest={m} />}
      {tab === "usage" && <UsageTab />}
      {tab === "help" && <HelpTab instance={instance} manifest={m} />}
    </div>
  );
}

function RunControls({ instance }: { instance: AgentInstance }) {
  const [busy, setBusy] = useState(false);
  const act = async (op: "pause" | "resume", done: string) => {
    setBusy(true);
    try {
      await agentOp(instance.id, { op });
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };
  const running = instance.status === "trial" || instance.status === "active";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AgentStatus status={instance.status} />
      {running ? (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("pause", "Paused. Nothing goes out until you resume.")}>
          <Pause aria-hidden /> Pause
        </Button>
      ) : instance.status === "paused" ? (
        <Button size="sm" disabled={busy} onClick={() => act("resume", "Back on.")}>
          <Play aria-hidden /> Resume
        </Button>
      ) : null}
    </div>
  );
}

/** The agent's terminal, open at once: who it is, when it runs, then its real work, live */
function TerminalTab({ instance, manifest }: { instance: AgentInstance; manifest: AgentManifest }) {
  const [busy, setBusy] = useState(false);
  const running = instance.status === "trial" || instance.status === "active";
  const act = async (op: "run" | "test_email" | "dry_run") => {
    setBusy(true);
    try {
      const r = await agentOp<Record<string, unknown>>(instance.id, { op });
      if (op === "test_email") toast.success(`Test email sent to ${String(r.to)}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };
  const schedule = describeSchedule(effectiveSchedule(instance.schedule, cronEvery(manifest)));
  const intro = [
    { text: `$ powerproof agents open ${manifest.id}`, tone: "cmd" as const },
    { text: `● ${manifest.name} · ${STATUS_WORD[instance.status]} · ${schedule} · ${nextRunLabel(instance).toLowerCase()}` },
    { text: `  replies: ${REPLY_RULES[instance.replyRule].label.toLowerCase()} · report: ${REPORT_FREQUENCY[instance.reportFrequency].toLowerCase()}`, tone: "dim" as const },
  ];
  return (
    <AgentTerminal
      instanceId={instance.id}
      title={manifest.id}
      intro={intro}
      height="h-[min(32rem,60dvh)]"
      toolbar={
        <>
          {running ? (
            <TerminalButton disabled={busy} onClick={() => act("run")}>
              <RefreshCw aria-hidden /> Run now
            </TerminalButton>
          ) : (
            <TerminalButton disabled={busy} onClick={() => act("dry_run")}>
              <Eye aria-hidden /> Free preview
            </TerminalButton>
          )}
          <TerminalButton disabled={busy || instance.status === "suspended"} onClick={() => act("test_email")}>
            <Mail aria-hidden /> Test email
          </TerminalButton>
        </>
      }
    />
  );
}

const STATUS_WORD: Record<AgentInstance["status"], string> = { setup: "setting up", trial: "free trial", active: "running", paused: "paused", trial_ended: "trial ended", suspended: "stopped" };

function StatusBanner({ instance, manifest }: { instance: AgentInstance; manifest: AgentManifest }) {
  if (instance.status === "paused")
    return (
      <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning-soft/40 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">{manifest.name} is paused.</p>
          <p>{PAUSED_WHY[instance.pausedReason ?? ""] ?? "Nothing goes out while it's paused."} Your data is kept.</p>
          {instance.pausedReason === "connection" && (
            <Link href="/agents/my/connections" className="mt-1 inline-flex min-h-11 items-center gap-1 font-semibold underline">
              Fix the connection <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    );
  if (instance.status === "trial_ended")
    return (
      <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning-soft/40 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden />
        <p>
          <span className="font-semibold">The {manifest.trial.credits} free credits are used up, so {manifest.name} has paused.</span> Everything it found and sent is kept. Buy credits in Usage &amp; billing to carry on.
        </p>
      </div>
    );
  if (instance.status === "suspended")
    return <div className="rounded-card border border-danger/40 bg-danger-soft/40 p-4 text-sm">PowerProof stopped this agent for your store. Write to support from the Help tab.</div>;
  return null;
}

function GenericOverview({ instance, manifest }: { instance: AgentInstance; manifest: AgentManifest }) {
  const { data, loading } = useApi(() => getMetrics(instance.id), [instance.id], { live: true });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {manifest.metrics.map((x) => (
        <ExplainedNumber key={x.key} label={x.label} explain={x.explain} loading={loading} value={x.kind === "money" ? formatMoney({ amount: data?.[x.key] ?? 0, currency: "INR" }) : String(data?.[x.key] ?? 0)} emphasis={x.headline} />
      ))}
    </div>
  );
}

export function runLine(r: AgentRun): string {
  const s = r.summary as { sent?: number; queued?: number; counts?: Record<string, number> };
  if (r.status === "failed" || r.status === "dead") return r.error ?? "It didn't finish.";
  if (r.status === "running") return "Working…";
  const parts = [s.sent ? `${s.sent} sent` : "", s.queued ? `${s.queued} queued for WhatsApp` : "", s.counts?.outside_window ? `${s.counts.outside_window} waiting for sending hours` : "", s.counts?.no_credits ? `${s.counts.no_credits} waiting for credits` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing needed doing.";
}

function SettingsTab({ instance, manifest }: { instance: AgentInstance; manifest: AgentManifest }) {
  const [value, setValue] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SettingsFields manifest={manifest} value={value ?? instance.settings} onChange={setValue} />
      <Link href="/agents/my/connections" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-primary underline-offset-4 hover:underline">
        Connectors it uses <ArrowRight className="size-4" aria-hidden />
      </Link>
      <Button
        size="lg"
        className="self-start"
        disabled={!value || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await saveAgentSettings(instance.id, value!);
            setValue(null);
            toast.success("Saved. The next run uses these.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Check the settings.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save settings
      </Button>
    </div>
  );
}

function UsageTab() {
  const { data, loading, error, reload } = useApi(getCredits, [], { live: true });
  const { data: store } = useCurrentStore();
  const [buying, setBuying] = useState(false);
  const [mode, setMode] = useViewMode("agent-credits", "table");
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <ExplainedNumber label="Credits left" value={loading || !data ? "…" : data.balance.toLocaleString("en-IN")} loading={loading} explain={`Credits are shared by all your agents. ${CREDIT_RULE} Previews are free. At zero, agents pause: nothing is charged without you.`} emphasis />
      <div className="flex flex-col gap-3 rounded-card border bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block font-semibold">Pay as you go</span>
          <span className="mt-1 block text-muted-foreground">Buy any number of credits at {formatMoney({ amount: CREDIT_PRICE.perCreditMinor, currency: CREDIT_PRICE.currency })} each. Failed tasks never use one.</span>
        </span>
        <Button className="shrink-0" onClick={() => setBuying(true)}>
          <Plus aria-hidden /> Buy credits
        </Button>
      </div>
      <BuyCredits open={buying} onOpenChange={setBuying} workspaceName={store?.workspaceName} onBought={reload} />
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Credit history</h3>
          <ViewToggle value={mode} onChange={setMode} />
        </div>
        {data?.entries.length ? (
          <BoxTable
            label="Credit history"
            mode={mode}
            rows={data.entries.slice(0, 50).map((e, i) => ({ ...e, i }))}
            rowKey={(e) => String(e.i)}
            columns={[
              { key: "what", label: "What", cell: (e) => e.reason ?? e.kind.replace(/_/g, " ") },
              { key: "when", label: "When", cell: (e) => formatDate(e.createdAt, { time: true }) },
              { key: "n", label: "Credits", numeric: true, cell: (e) => <span className={cn("font-semibold", e.delta > 0 && "text-success")}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span> },
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No credits used yet.</p>
        )}
      </div>
    </div>
  );
}

function HelpTab({ instance, manifest }: { instance: AgentInstance; manifest: AgentManifest }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const wa = supportWhatsApp();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <FaqAccordion items={manifest.help.faq.map((f, i) => ({ id: String(i), ...f }))} />
      {wa && (
        <Button asChild variant="secondary" size="lg" className="self-start">
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi, I need help with ${manifest.name}.`)}`} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden /> Chat with us on WhatsApp
          </a>
        </Button>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="help-msg" className="font-semibold">Something not right? Tell us</label>
        <Textarea id="help-msg" rows={4} maxLength={2000} value={msg} onChange={(e) => setMsg(e.target.value)} />
        <Button
          className="self-start"
          disabled={busy || !msg.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await reportProblem({ storeId: await currentStoreId(), instanceId: instance.id, kind: "help", message: msg.trim(), context: { agent: instance.agentId, status: instance.status } });
              setMsg("");
              toast.success("Sent. We'll get back to you by email.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "That didn't send.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
