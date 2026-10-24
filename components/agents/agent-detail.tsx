"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Mail, MessageCircle, Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AGENT_UI } from "@/agents/ui";
import { getManifest } from "@/agents/index";
import { ErrorState, EmptyState } from "@/components/pp/empty-state";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { agentOp, currentStoreId, getConnections, getCredits, getInstance, getMetrics, getRuns, reportProblem, saveAgentSettings, type AgentInstance, type AgentRun } from "@/lib/api/agents";
import type { AgentManifest } from "@/lib/agents/define";
import { formatDate, timeAgo } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AgentStatus, ExplainedNumber, PAUSED_WHY, supportWhatsApp } from "./bits";
import { SettingsFields } from "./settings-form";

type Tab = "overview" | "activity" | "settings" | "connections" | "usage" | "help";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
  { id: "connections", label: "Connections" },
  { id: "usage", label: "Usage & billing" },
  { id: "help", label: "Help" },
];

/** One agent's page: Overview, Activity, Settings, Connections, Usage & billing, Help (?tab=) */
export function AgentDetail({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const tab = (useSearchParams().get("tab") as Tab) || "overview";
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
      <PageHeader title={m.name} back={{ href: "/agents/my", label: "Agents" }} actions={<RunControls instance={instance} />} />
      <StatusBanner instance={instance} manifest={m} />
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4" aria-label={`${m.name} sections`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => router.replace(`/agents/my/${instance.id}${t.id === "overview" ? "" : `?tab=${t.id}`}`, { scroll: false })}
            className={cn("min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold transition-colors", tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </nav>
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
      {tab === "activity" && <Activity instanceId={instance.id} />}
      {tab === "settings" && <SettingsTab instance={instance} manifest={m} />}
      {tab === "connections" && <ConnectionsTab instance={instance} />}
      {tab === "usage" && <UsageTab manifest={m} />}
      {tab === "help" && <HelpTab instance={instance} manifest={m} />}
    </div>
  );
}

function RunControls({ instance }: { instance: AgentInstance }) {
  const [busy, setBusy] = useState(false);
  const act = async (op: string, done: string | ((r: Record<string, unknown>) => string)) => {
    setBusy(true);
    try {
      const r = await agentOp(instance.id, { op });
      toast.success(typeof done === "string" ? done : done(r));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };
  const running = instance.status === "trial" || instance.status === "active";
  // The owner's own copy of a real reminder: free, and never sent to a customer
  const testEmail = (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("test_email", (r) => `Test email sent to ${String(r.to)}. Check your inbox.`)}>
      <Mail aria-hidden /> Send me a test email
    </Button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AgentStatus status={instance.status} />
      {running ? (
        <>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("run", "Done. See Activity for what happened.")}>
            <RefreshCw aria-hidden /> Run now
          </Button>
          {testEmail}
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("pause", "Paused. Nothing goes out until you resume.")}>
            <Pause aria-hidden /> Pause
          </Button>
        </>
      ) : instance.status === "paused" ? (
        <>
          <Button size="sm" disabled={busy} onClick={() => act("resume", "Back on.")}>
            <Play aria-hidden /> Resume
          </Button>
          {testEmail}
        </>
      ) : instance.status === "trial_ended" ? (
        testEmail
      ) : null}
    </div>
  );
}

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
          <span className="font-semibold">The {manifest.trial.credits} free credits are used up, so {manifest.name} has paused.</span> Everything it found and sent is kept. Paid plans open soon; see Usage &amp; billing.
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

const TRIGGER: Record<AgentRun["trigger"], string> = { cron: "Scheduled run", manual: "You ran it", dry_run: "Free preview" };

export function runLine(r: AgentRun): string {
  const s = r.summary as { sent?: number; queued?: number; counts?: Record<string, number> };
  if (r.status === "failed" || r.status === "dead") return r.error ?? "It didn't finish.";
  if (r.status === "running") return "Working…";
  const parts = [s.sent ? `${s.sent} sent` : "", s.queued ? `${s.queued} queued for WhatsApp` : "", s.counts?.outside_window ? `${s.counts.outside_window} waiting for sending hours` : "", s.counts?.no_credits ? `${s.counts.no_credits} waiting for credits` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing needed doing.";
}

function Activity({ instanceId }: { instanceId: string }) {
  const { data, loading, error, reload } = useApi(() => getRuns(instanceId), [instanceId], { live: true });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-48 rounded-card" />;
  if (!data.length) return <EmptyState compact title="No runs yet" body="It runs every hour once it's on. Use Run now to try it straight away." />;
  return (
    <ul className="flex flex-col divide-y rounded-card border bg-surface">
      {data.map((r) => (
        <li key={r.id} className="flex items-start gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{TRIGGER[r.trigger]}</span>
            <span className="block text-sm text-muted-foreground">{runLine(r)}</span>
          </span>
          <span className="text-right text-sm text-muted-foreground">
            <span className="block">{timeAgo(r.startedAt)}</span>
            {(r.status === "failed" || r.status === "dead") && <StatusPill status="failed" label="Didn't finish" />}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SettingsTab({ instance, manifest }: { instance: AgentInstance; manifest: AgentManifest }) {
  const [value, setValue] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SettingsFields manifest={manifest} value={value ?? instance.settings} onChange={setValue} />
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

function ConnectionsTab({ instance }: { instance: AgentInstance }) {
  const { data, loading } = useApi(getConnections, [], { live: true });
  if (loading || !data) return <Skeleton className="h-32 rounded-card" />;
  const mine = data.filter((c) => c.usedBy.includes(instance.id));
  return (
    <div className="flex flex-col gap-3">
      {mine.length ? (
        <ul className="flex flex-col divide-y rounded-card border bg-surface">
          {mine.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 font-semibold">{c.label || "Connection"}</span>
              <StatusPill status={c.status === "connected" ? "connected" : "needs_attention"} label={c.status === "connected" ? "Connected" : c.status === "needs_reauth" ? "Connect again" : "Not working"} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">This agent uses no shared connections. Files you upload are read once and not kept.</p>
      )}
      <Button asChild variant="secondary" className="self-start">
        <Link href="/agents/my/connections">All connections</Link>
      </Button>
    </div>
  );
}

function UsageTab({ manifest }: { manifest: AgentManifest }) {
  const { data, loading, error, reload } = useApi(getCredits, [], { live: true });
  const plan = manifest.plans[0];
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <ExplainedNumber label="Credits left" value={loading || !data ? "…" : data.balance.toLocaleString("en-IN")} loading={loading} explain="Credits are shared by all your agents. One credit pays for one action, like one message sent or prepared. Previews are free. At zero, agents pause: nothing is charged without you." emphasis />
      {plan && (
        <div className="rounded-card border bg-surface p-4 text-sm">
          <p className="font-semibold">{manifest.name} monthly plan</p>
          <p className="mt-1 text-muted-foreground">
            {plan.launchPriceMinor !== undefined && plan.launchPriceMinor < plan.priceMinor ? `${formatMoney({ amount: plan.launchPriceMinor, currency: "INR" })} for the first month, then ` : ""}
            {formatMoney({ amount: plan.priceMinor, currency: "INR" })} a month, with {plan.includedCredits} credits included.
          </p>
          <p className="mt-2 font-semibold text-accent-ink">Coming soon: payments for agents open shortly.</p>
        </div>
      )}
      <div>
        <h3 className="mb-2 font-semibold">Credit history</h3>
        {data?.entries.length ? (
          <ul className="flex flex-col divide-y rounded-card border bg-surface text-sm">
            {data.entries.slice(0, 50).map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>
                  <span className="block">{e.reason ?? e.kind.replace(/_/g, " ")}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(e.createdAt, { time: true })}</span>
                </span>
                <span className={cn("font-semibold tabular", e.delta > 0 ? "text-success" : "")}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
              </li>
            ))}
          </ul>
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
