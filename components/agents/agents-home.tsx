"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Bot, Coins, Inbox, Plug, Sparkles } from "lucide-react";
import { getManifest } from "@/agents/index";
import { BoxTable, useViewMode, ViewToggle, type Column } from "@/components/pp/box-table";
import { ErrorState, EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { cronEvery, type AgentManifest } from "@/lib/agents/define";
import { describeSchedule, effectiveSchedule } from "@/lib/agents/schedule";
import { getActionItems, getConnections, getCredits, getMetrics, getMyAgents, getRuns, type AgentInstance, type AgentRun } from "@/lib/api/agents";
import { timeAgo } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AgentStatus, nextRunLabel } from "./bits";
import { CategoryIcon, toneFor } from "./catalog";
import { runLine } from "./agent-detail";

/**
 * Agents home (the Marketplace's "Subscribed agents" tab): three small tiles, then each agent as
 * one colourful card with its name, status, one number and its next run (the detail is on the
 * agent's own page), then recent activity. Agents and activity switch between boxes and a table.
 */
export function AgentsHome({ embedded = false }: { /** Inside the Marketplace's "Subscribed agents" tab, which has its own header */ embedded?: boolean }) {
  const agents = useApi(getMyAgents, [], { live: true });
  const queue = useApi(() => getActionItems(), [], { live: true });
  const credits = useApi(getCredits, [], { live: true });
  const connections = useApi(getConnections, [], { live: true });
  const [mode, setMode] = useViewMode("agents-home");
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
        {broken.length > 0 && (
          <Link href="/agents/my/connections" className="flex items-center gap-3 rounded-card border border-danger/40 bg-danger-soft/40 p-4 text-sm font-semibold">
            <AlertTriangle className="size-5 shrink-0 text-danger" aria-hidden />
            {broken.length === 1 ? `${broken[0].label || "A connector"} stopped working` : `${broken.length} connectors stopped working`}
            <ArrowUpRight className="ml-auto size-4" aria-hidden />
          </Link>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Tile icon={Coins} label="Credits" value={credits.data?.balance.toLocaleString("en-IN")} tone="#f59e0b" />
          <Tile icon={Inbox} label="Waiting for you" value={queue.data ? toDo : undefined} tone="#f2685a" href="/agents/my/queue" />
          <Tile icon={Plug} label="Connectors" value={connections.data?.length} tone="#2b9fe0" href="/agents/my/connections" />
        </div>

        {agents.loading || !agents.data ? (
          <Skeleton className="h-48 rounded-card" />
        ) : agents.data.length ? (
          <section aria-labelledby="mine" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="mine" className="text-lg">Your agents</h2>
              <ViewToggle value={mode} onChange={setMode} />
            </div>
            <AgentList agents={agents.data} mode={mode} />
          </section>
        ) : (
          <EmptyState
            icon={Bot}
            title="No agents yet"
            action={
              <Button asChild>
                <Link href="/marketplace">See the agents</Link>
              </Button>
            }
          />
        )}
        {agents.data && agents.data.length > 0 && <RecentActivity agents={agents.data} mode={mode} />}
      </div>
    </>
  );
}

function Tile({ icon: Icon, label, value, tone, href }: { icon: typeof Coins; label: string; value: React.ReactNode; tone: string; href?: string }) {
  const body = (
    <span className="flex h-full flex-col gap-2 rounded-card border p-3.5 transition-colors sm:p-4" style={{ backgroundImage: `linear-gradient(140deg, color-mix(in oklab, ${tone} 16%, var(--surface)), var(--surface) 70%)`, borderColor: `color-mix(in oklab, ${tone} 30%, var(--border))` }}>
      <span className="grid size-8 place-items-center rounded-control text-white" style={{ background: tone }}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="font-display text-2xl leading-none font-bold tabular">{value ?? "…"}</span>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="rounded-card hover:brightness-[0.98] focus-visible:outline-2 dark:hover:brightness-110">
      {body}
    </Link>
  ) : (
    body
  );
}

const hrefOf = (i: AgentInstance) => (i.status === "setup" ? `/agents/my/${i.id}/setup` : `/agents/my/${i.id}`);
const runsOf = (i: AgentInstance, m: AgentManifest) => describeSchedule(effectiveSchedule(i.schedule, cronEvery(m)));

/** The one number on an agent's card: its first headline metric */
function Headline({ instance, m }: { instance: AgentInstance; m: AgentManifest }) {
  const metrics = useApi(() => getMetrics(instance.id), [instance.id], { live: true });
  const h = m.metrics.find((x) => x.headline);
  if (!h || instance.status === "setup") return null;
  const v = metrics.data?.[h.key] ?? 0;
  return (
    <span className="flex flex-col">
      <span className="font-display text-2xl leading-tight font-bold tabular">{metrics.data ? (h.kind === "money" ? formatMoney({ amount: v, currency: "INR" }).replace(/\.00$/, "") : v.toLocaleString("en-IN")) : "…"}</span>
      <span className="text-xs opacity-75">{h.label}</span>
    </span>
  );
}

function AgentList({ agents, mode }: { agents: AgentInstance[]; mode: "box" | "table" }) {
  const rows = agents.map((i) => ({ i, m: getManifest(i.agentId) })).filter((r): r is { i: AgentInstance; m: AgentManifest } => !!r.m);
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "name", label: "Agent", cell: ({ i, m }) => <Link href={hrefOf(i)} className="font-semibold hover:underline">{m.name}</Link> },
    { key: "status", label: "Status", cell: ({ i }) => <AgentStatus status={i.status} /> },
    { key: "number", label: "Number", cell: ({ i, m }) => <Headline instance={i} m={m} /> },
    { key: "runs", label: "Runs", cell: ({ i, m }) => runsOf(i, m) },
    { key: "next", label: "Next run", cell: ({ i }) => nextRunLabel(i) },
  ];
  return (
    <BoxTable
      label="Your agents"
      mode={mode}
      rows={rows}
      columns={columns}
      rowKey={(r) => r.i.id}
      box={({ i, m }) => {
        const tone = toneFor(m.category);
        return (
          <Link
            href={hrefOf(i)}
            className="group relative flex h-full min-h-40 flex-col justify-between gap-4 overflow-hidden rounded-card p-5 text-white shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:hover:translate-y-0"
            style={{ background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 55%, black))` }}
          >
            <span aria-hidden className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-white/10" />
            <span className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-control bg-white/15 backdrop-blur">
                <CategoryIcon category={m.category} className="size-5" />
              </span>
              <StatusDot instance={i} />
            </span>
            <span className="flex flex-col gap-3">
              <span className="text-lg leading-tight font-bold">{m.name}</span>
              <span className="flex items-end justify-between gap-3">
                <Headline instance={i} m={m} />
                <span className="text-right text-xs opacity-80">{i.status === "setup" ? "Finish setup" : nextRunLabel(i)}</span>
              </span>
            </span>
          </Link>
        );
      }}
    />
  );
}

const DOT: Record<AgentInstance["status"], [string, string]> = {
  setup: ["Setting up", "bg-white/70"],
  trial: ["Free trial", "bg-[#ffd166]"],
  active: ["Running", "bg-[#56d364]"],
  paused: ["Paused", "bg-white/50"],
  trial_ended: ["Trial ended", "bg-[#ffb199]"],
  suspended: ["Stopped", "bg-[#ff7b72]"],
};

function StatusDot({ instance }: { instance: AgentInstance }) {
  const [label, dot] = DOT[instance.status];
  const running = instance.status === "active" || instance.status === "trial";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold backdrop-blur">
      <span className={cn("size-2 rounded-full", dot, running && "motion-safe:animate-pulse")} aria-hidden />
      {label}
    </span>
  );
}

function RecentActivity({ agents, mode }: { agents: AgentInstance[]; mode: "box" | "table" }) {
  const live = agents.filter((a) => a.status !== "setup");
  const runs = useApi(async () => (await Promise.all(live.map(async (a) => (await getRuns(a.id, 5)).map((r) => ({ r, a }))))).flat().sort((x, y) => y.r.startedAt.localeCompare(x.r.startedAt)).slice(0, 8), [live.map((a) => a.id).join(",")], { live: true });
  if (!runs.data?.length) return null;
  const columns: Column<{ r: AgentRun; a: AgentInstance }>[] = [
    { key: "agent", label: "Agent", cell: ({ a }) => <Link href={`/agents/my/${a.id}`} className="font-semibold hover:underline">{getManifest(a.agentId)?.name}</Link> },
    { key: "what", label: "What happened", cell: ({ r }) => runLine(r) },
    { key: "when", label: "When", cell: ({ r }) => timeAgo(r.startedAt) },
  ];
  return (
    <section aria-labelledby="recent" className="flex flex-col gap-3">
      <h2 id="recent" className="text-lg">Recent activity</h2>
      <BoxTable label="Recent activity" mode={mode} rows={runs.data} columns={columns} rowKey={({ r }) => r.id} />
    </section>
  );
}
