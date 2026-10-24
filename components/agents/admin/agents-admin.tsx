"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatCard } from "@/components/pp/stat-card";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/use-api";
import { adminGet, adminOp } from "@/lib/api/agents";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** PowerProof Agents for staff: one page, sections as ?tab= */

type Tab = "overview" | "demand" | "catalog" | "runs" | "margin" | "support" | "stores";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "demand", label: "Demand" },
  { id: "catalog", label: "Catalog" },
  { id: "runs", label: "Failures" },
  { id: "margin", label: "Margin" },
  { id: "support", label: "Support" },
  { id: "stores", label: "Stores" },
];

async function op(body: Record<string, unknown>, done: string) {
  try {
    await adminOp(body);
    toast.success(done);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "That didn't save.");
  }
}

export function AgentsAdmin() {
  const router = useRouter();
  const tab = (useSearchParams().get("tab") as Tab) || "overview";
  return (
    <div className="flex flex-col gap-5">
      <title>Agents · PowerProof admin</title>
      <PageHeader title="Agents" />
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4" aria-label="Agents admin sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => router.replace(`/admin/agents?tab=${t.id}`, { scroll: false })} className={cn("min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold", tab === t.id ? "border-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "overview" && <Overview />}
      {tab === "demand" && <Demand />}
      {tab === "catalog" && <Catalog />}
      {tab === "runs" && <Failures />}
      {tab === "margin" && <Margin />}
      {tab === "support" && <Support />}
      {tab === "stores" && <Stores />}
    </div>
  );
}

type OverviewData = {
  funnel: { agentId: string; name: string; enabled: boolean; started: number; switchedOn: number; trial: number; trialEnded: number; paused: number; paid: number; conversionPct: number }[];
  failedRuns7d: number;
  deadJobs: number;
  connections: { connected: number; needsReauth: number; error: number };
  openSupport: number;
  demandRequests: number;
  switches: { runsEnabled: boolean; sendingEnabled: boolean; llmProvider: "gemini" | "anthropic" };
};

function Overview() {
  const { data, loading, error, reload } = useApi(() => adminGet<OverviewData>("overview"), [], { live: true });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-72 rounded-card" />;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Failed runs, 7 days" value={data.failedRuns7d} />
        <StatCard label="Dead jobs" value={data.deadJobs} />
        <StatCard label="Connections broken" value={data.connections.needsReauth + data.connections.error} hint={`${data.connections.connected} working`} />
        <StatCard label="Open support" value={data.openSupport} hint={`${data.demandRequests} demand requests`} />
      </div>
      <section className="flex flex-col gap-3 rounded-card border bg-surface p-5" aria-labelledby="switches">
        <h2 id="switches" className="text-base font-semibold">Kill switches</h2>
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Agents run</span>
            <span className="block text-sm text-muted-foreground">Off: no agent runs for any store (the scheduler claims nothing).</span>
          </span>
          <Switch checked={data.switches.runsEnabled} onCheckedChange={(v) => op({ op: "switches", runsEnabled: v }, v ? "Runs back on." : "All runs stopped.").then(reload)} />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Messages go out</span>
            <span className="block text-sm text-muted-foreground">Off: runs still plan and draft, but nothing is sent or queued.</span>
          </span>
          <Switch checked={data.switches.sendingEnabled} onCheckedChange={(v) => op({ op: "switches", sendingEnabled: v }, v ? "Sending back on." : "All sending stopped.").then(reload)} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Model provider</span>
            <span className="block text-sm text-muted-foreground">Used unless an agent&apos;s manifest names its own.</span>
          </span>
          <div className="flex gap-2">
            {(["gemini", "anthropic"] as const).map((p) => (
              <Button key={p} size="sm" variant={data.switches.llmProvider === p ? "primary" : "secondary"} onClick={() => op({ op: "switches", llmProvider: p }, `Now using ${p === "gemini" ? "Gemini" : "Anthropic"}.`).then(reload)}>
                {p === "gemini" ? "Gemini" : "Anthropic"}
              </Button>
            ))}
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="funnel">
        <h2 id="funnel" className="text-base font-semibold">Trial to paid</h2>
        {data.funnel.map((f) => (
          <div key={f.agentId} className="flex flex-col gap-3 rounded-card border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{f.name}</span>
              <label className="flex items-center gap-2 text-sm">
                Agent on <Switch checked={f.enabled} onCheckedChange={(v) => op({ op: "agent_enabled", agentId: f.agentId, enabled: v }, v ? `${f.name} on.` : `${f.name} stopped for every store.`).then(reload)} />
              </label>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-sm sm:grid-cols-6">
              {[
                ["Started", f.started],
                ["Switched on", f.switchedOn],
                ["In trial", f.trial],
                ["Trial ended", f.trialEnded],
                ["Paying", f.paid],
                ["Conversion", `${f.conversionPct}%`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-display text-xl font-bold tabular">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>
    </div>
  );
}

type DemandData = { leaderboard: { agentId: string; name: string; status: string; requests: number }[]; requests: { id: string; agent: string; email: string; mobile: string | null; note: string | null; fromStore: boolean; at: string }[] };

function Demand() {
  const { data, loading, error, reload } = useApi(() => adminGet<DemandData>("demand"), [], { live: true });
  const columns = useMemo<ColumnDef<DemandData["requests"][number], unknown>[]>(
    () => [
      { accessorKey: "agent", header: "Agent" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "mobile", header: "Mobile", cell: ({ getValue }) => (getValue() as string) || "—" },
      { accessorKey: "note", header: "Note", cell: ({ getValue }) => <span className="block max-w-[320px] truncate">{(getValue() as string) || "—"}</span> },
      { id: "at", accessorFn: (r) => r.at, header: "When", enableSorting: true, cell: ({ row }) => formatDate(row.original.at) },
    ],
    []
  );
  return (
    <div className="flex flex-col gap-5">
      {data && (
        <ol className="flex flex-col divide-y rounded-card border bg-surface">
          {data.leaderboard.map((l, i) => (
            <li key={l.agentId} className="flex items-center gap-3 px-4 py-3">
              <span className="w-6 font-mono text-sm text-muted-foreground">{i + 1}</span>
              <span className="flex-1 font-semibold">{l.name}</span>
              <StatusPill status={l.status} />
              <span className="w-16 text-right font-display text-xl font-bold tabular">{l.requests}</span>
            </li>
          ))}
        </ol>
      )}
      <DataTable label="Demand requests" columns={columns} data={data?.requests} loading={loading && !data} error={error} onRetry={reload} searchPlaceholder="Search agent or note" empty={<EmptyState title="No requests yet." body="“I need this” on a coming-soon agent lands here." />} />
    </div>
  );
}

type CatalogRow = { id: string; name: string; tagline: string; description: string; category: string; status: "live" | "coming_soon" | "hidden"; enabled: boolean; sort: number };

function Catalog() {
  const { data, loading, error, reload } = useApi(() => adminGet<{ catalog: CatalogRow[]; codeAgents: string[] }>("catalog"), [], { live: true });
  const [edit, setEdit] = useState<CatalogRow | null>(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64 rounded-card" />;
  const blank: CatalogRow = { id: "", name: "", tagline: "", description: "", category: "Other", status: "coming_soon", enabled: true, sort: 100 };
  return (
    <div className="flex flex-col gap-4">
      <Button className="self-start" onClick={() => setEdit(blank)}>
        Add a coming-soon agent
      </Button>
      {edit && (
        <form
          className="flex flex-col gap-3 rounded-card border bg-surface p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            await op({ op: "catalog_save", agentId: edit.id, name: edit.name, tagline: edit.tagline, description: edit.description, category: edit.category, status: edit.status, sort: edit.sort }, "Saved.");
            setEdit(null);
            reload();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["id", "name", "tagline", "category"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <Label htmlFor={`cat-${k}`}>{k === "id" ? "Id (a-z, dashes)" : k[0].toUpperCase() + k.slice(1)}</Label>
                <Input id={`cat-${k}`} value={edit[k]} disabled={k === "id" && data.catalog.some((c) => c.id === edit.id)} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cat-desc">Description</Label>
            <Input id="cat-desc" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["coming_soon", "live", "hidden"] as const).map((s) => (
              <Button key={s} type="button" size="sm" variant={edit.status === s ? "primary" : "secondary"} disabled={s === "live" && !data.codeAgents.includes(edit.id)} onClick={() => setEdit({ ...edit, status: s })}>
                {s === "coming_soon" ? "Coming soon" : s === "live" ? "Live (needs code)" : "Hidden"}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      <ul className="flex flex-col divide-y rounded-card border bg-surface">
        {data.catalog.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{c.name}</span>
              <span className="block text-sm text-muted-foreground">
                {c.id} · {c.category}
              </span>
            </span>
            <StatusPill status={c.status} />
            {!c.enabled && <StatusPill status="paused" label="Switched off" />}
            <Button size="sm" variant="secondary" onClick={() => setEdit(c)}>
              Edit
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type RunsData = { runs: { id: string; store: string; storeId: string; agent: string; trigger: string; status: string; error: string | null; at: string }[]; deadJobs: { id: string; store: string; kind: string; attempts: number; error: string | null; at: string }[] };

function Failures() {
  const { data, loading, error, reload } = useApi(() => adminGet<RunsData>("runs"), [], { live: true });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64 rounded-card" />;
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Dead letters ({data.deadJobs.length})</h2>
        {data.deadJobs.length ? (
          <ul className="flex flex-col divide-y rounded-card border bg-surface">
            {data.deadJobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {j.kind} · {j.store}
                  </span>
                  <span className="block text-danger">{j.error ?? "No error recorded"}</span>
                  <span className="block text-muted-foreground">
                    {j.attempts} attempts · {formatDate(j.at, { time: true })}
                  </span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => op({ op: "retry_job", jobId: j.id }, "Queued again.").then(reload)}>
                  Retry
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">None. Every job finished or is still retrying.</p>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Failed runs</h2>
        {data.runs.length ? (
          <ul className="flex flex-col divide-y rounded-card border bg-surface">
            {data.runs.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <span className="block font-semibold">
                  {r.agent} · <Link href={`/admin/agents/stores/${r.storeId}`} className="underline">{r.store}</Link> · {r.trigger}
                </span>
                <span className="block text-danger">{r.error ?? r.status}</span>
                <span className="block text-muted-foreground">{formatDate(r.at, { time: true })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No failed runs.</p>
        )}
      </section>
    </div>
  );
}

type MarginRow = { creditsUsed: number; valueUsd: number; llmUsd: number; emailUsd: number; costUsd: number; costPerCreditUsd: number | null; losing: boolean; tokens: number };
type MarginData = { creditUsd: number; usdInr: number; revenueNote: string | null; agents: (MarginRow & { agentId: string; name: string })[]; stores: (MarginRow & { storeId: string; store: string; agent: string })[] };

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

function Margin() {
  const { data, loading, error, reload } = useApi(() => adminGet<MarginData>("margin"), [], { live: true });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64 rounded-card" />;
  const line = (r: MarginRow, title: React.ReactNode, key: string) => (
    <li key={key} className={cn("grid grid-cols-2 gap-2 px-4 py-3 text-sm sm:grid-cols-6", r.losing && "bg-danger-soft/50")}>
      <span className="col-span-2 font-semibold sm:col-span-1">{title}</span>
      <span>{r.creditsUsed} credits</span>
      <span>Value {usd(r.valueUsd)}</span>
      <span>Model {usd(r.llmUsd)}</span>
      <span>Email {usd(r.emailUsd)}</span>
      <span className={cn("font-semibold", r.losing && "text-danger")}>{r.costPerCreditUsd === null ? "—" : `${usd(r.costPerCreditUsd)} per credit`}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Last 30 days. A credit is worth {usd(data.creditUsd)} (≈ ₹{(data.creditUsd * data.usdInr).toFixed(2)}). Red: a credit costs more than it&apos;s worth. {data.revenueNote}
      </p>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">By agent</h2>
        {data.agents.length ? <ul className="flex flex-col divide-y rounded-card border bg-surface">{data.agents.map((a) => line(a, a.name, a.agentId))}</ul> : <p className="text-sm text-muted-foreground">No usage yet.</p>}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">By store (costliest first)</h2>
        {data.stores.length ? <ul className="flex flex-col divide-y rounded-card border bg-surface">{data.stores.map((s) => line(s, <Link href={`/admin/agents/stores/${s.storeId}`} className="underline">{s.store} · {s.agent}</Link>, `${s.storeId}-${s.agent}`))}</ul> : <p className="text-sm text-muted-foreground">No usage yet.</p>}
      </section>
    </div>
  );
}

type SupportRow = { id: string; store: string; storeId: string; kind: string; message: string; context: Record<string, unknown>; status: string; at: string };

function Support() {
  const { data, loading, error, reload } = useApi(() => adminGet<SupportRow[]>("support"), [], { live: true });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64 rounded-card" />;
  if (!data.length) return <EmptyState title="No support items." body="“Report a wrong message” and help requests land here." />;
  return (
    <ul className="flex flex-col gap-3">
      {data.map((s) => (
        <li key={s.id} className="flex flex-col gap-2 rounded-card border bg-surface p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={s.status} />
            <span className="font-semibold">{s.kind === "wrong_message" ? "Wrong message" : s.kind === "help" ? "Help" : "Other"}</span>
            <Link href={`/admin/agents/stores/${s.storeId}`} className="underline">
              {s.store}
            </Link>
            <span className="text-muted-foreground">{formatDate(s.at, { time: true })}</span>
          </div>
          <p className="whitespace-pre-wrap">{s.message}</p>
          {typeof s.context.body === "string" && <p className="rounded-control bg-muted p-3 whitespace-pre-wrap">{s.context.body}</p>}
          {s.status === "open" && (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => op({ op: "close_support", id: s.id }, "Closed.").then(reload)}>
              Close
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

type StoreRow = { id: string; storeId: string; store: string; agent: string; status: string; pausedReason: string | null; credits: number; lastRunAt: string | null; createdAt: string };

function Stores() {
  const { data, loading, error, reload } = useApi(() => adminGet<StoreRow[]>("stores"), [], { live: true });
  const columns = useMemo<ColumnDef<StoreRow, unknown>[]>(
    () => [
      { accessorKey: "store", header: "Store", cell: ({ row }) => <Link href={`/admin/agents/stores/${row.original.storeId}`} className="font-semibold underline">{row.original.store}</Link> },
      { accessorKey: "agent", header: "Agent" },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { accessorKey: "credits", header: "Credits", meta: { align: "right" } },
      { id: "last", accessorFn: (r) => r.lastRunAt ?? "", header: "Last run", enableSorting: true, cell: ({ row }) => (row.original.lastRunAt ? formatDate(row.original.lastRunAt, { time: true }) : "—") },
    ],
    []
  );
  return <DataTable label="Stores using agents" columns={columns} data={data} loading={loading && !data} error={error} onRetry={reload} searchPlaceholder="Search store" empty={<EmptyState title="No store has an agent yet." />} />;
}
