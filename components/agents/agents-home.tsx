"use client";

import Link from "next/link";
import { AlertTriangle, Bot, Sparkles } from "lucide-react";
import { getManifest } from "@/agents/index";
import { ErrorState, EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatCard } from "@/components/pp/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getActionItems, getConnections, getCredits, getMetrics, getMyAgents, getRuns, type AgentInstance } from "@/lib/api/agents";
import { timeAgo } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { AgentStatus, PAUSED_WHY } from "./bits";
import { runLine } from "./agent-detail";

/**
 * Agents home (the Marketplace's "Subscribed agents" tab), laid out like the app's other pages: the header, alerts, a row of numbers (credits,
 * the queue, connections), the agents, then recent activity.
 */
export function AgentsHome({ embedded = false }: { /** Inside the Marketplace's "Subscribed agents" tab, which has its own header */ embedded?: boolean }) {
  const agents = useApi(getMyAgents, [], { live: true });
  const queue = useApi(() => getActionItems(), [], { live: true });
  const credits = useApi(getCredits, [], { live: true });
  const connections = useApi(getConnections, [], { live: true });
  if (agents.error) return <ErrorState message={agents.error} onRetry={agents.reload} />;
  const broken = (connections.data ?? []).filter((c) => c.status !== "connected");
  const toDo = queue.data?.length ?? 0;

  return (
    <>
      {!embedded && (
        <PageHeader
          title="Agents"
          actions={
            <Button asChild variant="secondary">
              <Link href="/marketplace">
                <Sparkles aria-hidden /> Browse agents
              </Link>
            </Button>
          }
        />
      )}
      <div className="flex flex-col gap-6">
        {broken.map((c) => (
          <Link key={c.id} href="/agents/my/connections" className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger-soft/40 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
            <span>
              <span className="block font-semibold">{c.label || "A connection"} stopped working.</span>
              <span className="block">Agents that use it are paused until it&apos;s fixed. Tap to fix.</span>
            </span>
          </Link>
        ))}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Credits left" value={credits.data?.balance.toLocaleString("en-IN")} loading={credits.loading && !credits.data} hint="Shared by all your agents" />
          <Link href="/agents/my/queue" className="rounded-card focus-visible:outline-2">
            <StatCard label="Waiting for you" value={queue.data ? toDo : undefined} loading={!queue.data} hint={toDo ? "Messages to send, calls to make" : "Nothing to do"} className="h-full transition-colors hover:border-primary/40" />
          </Link>
          <Link href="/agents/my/connections" className="rounded-card focus-visible:outline-2">
            <StatCard label="Connections" value={connections.data?.length} loading={!connections.data} hint={broken.length ? `${broken.length} need fixing` : "Shared by all agents"} className="h-full transition-colors hover:border-primary/40" />
          </Link>
        </div>
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
                <Link href="/marketplace">See the agents</Link>
              </Button>
            }
          />
        )}
        {agents.data && agents.data.length > 0 && <RecentActivity agents={agents.data} />}
      </div>
    </>
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
                <span className="block text-xs text-muted-foreground">{h.label}</span>
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
      <h2 id="recent" className="text-base">Recent activity</h2>
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
