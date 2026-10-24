"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Bot, Inbox, Plug, Sparkles } from "lucide-react";
import { getManifest } from "@/agents/index";
import { ErrorState, EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getActionItems, getConnections, getCredits, getMetrics, getMyAgents, getRuns, type AgentInstance } from "@/lib/api/agents";
import { timeAgo } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { AgentStatus, ExplainedNumber, PAUSED_WHY } from "./bits";
import { runLine } from "./agent-detail";

/** Agents home: each agent with its status and headline numbers, the queue, alerts and recent activity */
export function AgentsHome() {
  const agents = useApi(getMyAgents, [], { live: true });
  const queue = useApi(() => getActionItems(), [], { live: true });
  const credits = useApi(getCredits, [], { live: true });
  const connections = useApi(getConnections, [], { live: true });
  if (agents.error) return <ErrorState message={agents.error} onRetry={agents.reload} />;
  const broken = (connections.data ?? []).filter((c) => c.status !== "connected");
  const toDo = queue.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agents"
        actions={
          <Button asChild variant="secondary">
            <Link href="/agents">
              <Sparkles aria-hidden /> Browse agents
            </Link>
          </Button>
        }
      />
      {broken.map((c) => (
        <Link key={c.id} href="/agents/my/connections" className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger-soft/40 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <span>
            <span className="block font-semibold">{c.label || "A connection"} stopped working.</span>
            <span className="block">Agents that use it are paused until it&apos;s fixed. Tap to fix.</span>
          </span>
        </Link>
      ))}
      {toDo > 0 && (
        <Link href="/agents/my/queue" className="flex min-h-16 items-center justify-between gap-3 rounded-card border border-primary/30 bg-primary-soft p-4">
          <span className="flex items-center gap-3">
            <Inbox className="size-5" aria-hidden />
            <span>
              <span className="block font-semibold">{toDo} {toDo === 1 ? "thing needs" : "things need"} you</span>
              <span className="block text-sm text-muted-foreground">WhatsApp messages to send, calls to make</span>
            </span>
          </span>
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      )}
      {agents.loading || !agents.data ? (
        <Skeleton className="h-48 rounded-card" />
      ) : agents.data.length ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {agents.data.map((a) => (
            <AgentCard key={a.id} instance={a} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          body="Agents do follow-ups for you, every day, on their own. Start with a free trial."
          action={
            <Button asChild>
              <Link href="/agents">See the agents</Link>
            </Button>
          }
        />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ExplainedNumber label="Credits left" value={credits.data ? credits.data.balance.toLocaleString("en-IN") : "…"} loading={credits.loading} explain="Shared by all your agents. One credit pays for one action, like one message. At zero, agents pause: nothing is charged without you." />
        <Link href="/agents/my/connections" className="flex min-h-11 items-center gap-3 rounded-card border bg-surface p-4 hover:border-primary/40 md:p-5">
          <Plug className="size-5 text-muted-foreground" aria-hidden />
          <span className="flex-1">
            <span className="block font-semibold">Connections</span>
            <span className="block text-sm text-muted-foreground">{connections.data ? `${connections.data.length} connected, shared by all agents` : "…"}</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      </div>
      {agents.data && agents.data.length > 0 && <RecentActivity agents={agents.data} />}
    </div>
  );
}

function AgentCard({ instance }: { instance: AgentInstance }) {
  const m = getManifest(instance.agentId);
  const metrics = useApi(() => getMetrics(instance.id), [instance.id]);
  if (!m) return null;
  const headline = m.metrics.filter((x) => x.headline).slice(0, 2);
  const href = instance.status === "setup" ? `/agents/my/${instance.id}/setup` : `/agents/my/${instance.id}`;
  return (
    <li>
      <Link href={href} className="flex h-full flex-col gap-3 rounded-card border bg-surface p-5 transition-colors hover:border-primary/40">
        <span className="flex items-center justify-between gap-2">
          <span className="text-lg font-semibold">{m.name}</span>
          <AgentStatus status={instance.status} />
        </span>
        {instance.status === "setup" ? (
          <span className="text-sm text-muted-foreground">Finish setting it up. The preview is free.</span>
        ) : (
          <span className="grid grid-cols-2 gap-3">
            {headline.map((h) => (
              <span key={h.key}>
                <span className="eyebrow block">{h.label}</span>
                <span className="font-display text-xl font-bold tabular">{metrics.data ? (h.kind === "money" ? formatMoney({ amount: metrics.data[h.key] ?? 0, currency: "INR" }).replace(/\.00$/, "") : (metrics.data[h.key] ?? 0)) : "…"}</span>
              </span>
            ))}
          </span>
        )}
        {instance.status === "paused" && <span className="text-sm text-muted-foreground">{PAUSED_WHY[instance.pausedReason ?? ""] ?? "Paused."}</span>}
        {instance.lastRunAt && <span className="text-xs text-muted-foreground">Last ran {timeAgo(instance.lastRunAt)}</span>}
      </Link>
    </li>
  );
}

function RecentActivity({ agents }: { agents: AgentInstance[] }) {
  const live = agents.filter((a) => a.status !== "setup");
  const runs = useApi(async () => (await Promise.all(live.map(async (a) => (await getRuns(a.id, 5)).map((r) => ({ r, a }))))).flat().sort((x, y) => y.r.startedAt.localeCompare(x.r.startedAt)).slice(0, 8), [live.map((a) => a.id).join(",")], { live: true });
  if (!runs.data?.length) return null;
  return (
    <section aria-labelledby="recent" className="flex flex-col gap-2">
      <h2 id="recent" className="text-base font-semibold">Recent activity</h2>
      <ul className="flex flex-col divide-y rounded-card border bg-surface">
        {runs.data.map(({ r, a }) => (
          <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <span className="block font-semibold">{getManifest(a.agentId)?.name}</span>
              <span className="block text-muted-foreground">{runLine(r)}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">{timeAgo(r.startedAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
