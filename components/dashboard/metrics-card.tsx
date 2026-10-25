"use client";

import { useId, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState } from "@/components/pp/empty-state";
import { LiveStatusBadge } from "@/components/pp/live-status";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveStore } from "@/hooks/use-live-store";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getDashboardMetrics } from "@/lib/api/activity";
import { METRIC_RANGES, type MetricRange, type MetricSummary } from "@/lib/dashboard-metrics";
import { formatNumber } from "@/lib/format";
import { formatMoney, money } from "@/lib/money";
import type { CurrencyCode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "sales" | "visitors" | "payments";

const TABS: { value: Tab; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "visitors", label: "Visitors" },
  { value: "payments", label: "Payments" },
];

/** What each tab's numbers and two chart series mean */
const COPY: Record<Tab, { main: string; second: (s: MetricSummary) => string; series: string; extra: string; empty: string; money: boolean }> = {
  sales: { main: "Revenue", second: (s) => `${formatNumber(s.secondary)} ${s.secondary === 1 ? "order" : "orders"} paid`, series: "Revenue", extra: "Orders", empty: "No paid orders in this period.", money: true },
  visitors: { main: "Visitors", second: (s) => `${formatNumber(s.secondary)} page ${s.secondary === 1 ? "view" : "views"}`, series: "Visitors", extra: "Page views", empty: "No visits recorded in this period.", money: false },
  payments: { main: "Collected", second: (s) => `${s.secondary}% of payment attempts succeeded`, series: "Collected", extra: "Failed or abandoned", empty: "No payment attempts in this period.", money: true },
};

function Change({ v }: { v: number | null }) {
  if (v == null) return <span className="text-xs text-muted-foreground">No earlier data to compare</span>;
  const up = v >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
      <span className="sr-only">{up ? "Up" : "Down"}</span>
      {Math.abs(v).toFixed(0)}% <span className="font-normal text-muted-foreground">vs previous period</span>
    </span>
  );
}

/**
 * Sales, Visitors and Payments in one card: a tab for each, one period picker (1D, 7D, 30D) for
 * all three, the main number with its change against the period before, and the chart. Numbers come
 * from paid orders, storefront visits and payment events; nothing is estimated. Stays current
 * through live updates.
 */
export function MetricsCard({ className }: { className?: string }) {
  const [tab, setTab] = useState<Tab>("sales");
  const [range, setRange] = useState<MetricRange>("7d");
  const { data, loading, error, reload } = useApi(() => getDashboardMetrics(range), [range]);
  const live = useLiveStore(["orders", "payment_events", "store_events"], reload);
  const reduced = useReducedMotion();
  const gid = useId().replace(/:/g, "");
  const c = COPY[tab];
  const s = data?.[tab];
  const cur = (data?.currency ?? "INR") as CurrencyCode;
  const fmt = (minor: number) => formatMoney(money(minor, cur));
  const show = (v: number) => (c.money ? fmt(v) : formatNumber(v));
  const empty = !!s && s.buckets.every((b) => !b.value && !b.extra);
  const rangeLong = METRIC_RANGES.find((r) => r.value === range)!.long;

  return (
    <section aria-labelledby="metrics-h" className={cn("flex flex-col rounded-card border bg-surface", className)}>
      <h2 id="metrics-h" className="sr-only">Store performance</h2>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b px-5 pt-2">
        <StatusTabs label="Metric" value={tab} onChange={setTab} tabs={TABS} className="mb-0 border-b-0" />
        <div className="flex items-center gap-2 pb-2">
          <LiveStatusBadge status={live} className="max-sm:hidden" />
          <Select value={range} onValueChange={(v) => setRange(v as MetricRange)}>
            <SelectTrigger size="sm" className="w-20" aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {METRIC_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5" role="tabpanel" aria-label={`${c.main}, ${rangeLong}`}>
        {error ? (
          <ErrorState message={error} onRetry={reload} className="flex-1 py-6" />
        ) : !s || (loading && !data) ? (
          <>
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-48 w-full" />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">
                  {c.main}, {rangeLong}
                </p>
                <p className="font-display text-3xl font-bold tracking-[-0.03em] tabular-nums">{show(s.primary)}</p>
                <Change v={s.change} />
              </div>
              <div className="text-right text-sm">
                <p className="font-medium">{c.second(s)}</p>
                <p className="text-xs text-muted-foreground">Previous period: {show(s.previous)}</p>
              </div>
            </div>
            <div className="relative h-48" aria-hidden={empty || undefined}>
              {empty && <p className="pointer-events-none absolute inset-x-0 top-12 z-10 text-center text-sm text-muted-foreground">{c.empty}</p>}
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={s.buckets} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" minTickGap={16} stroke="var(--muted-foreground)" />
                  <YAxis yAxisId="v" tickLine={false} axisLine={false} fontSize={11} width={c.money ? 64 : 32} stroke="var(--muted-foreground)" tickFormatter={(v: number) => (c.money ? fmt(v).replace(/\.00$/, "") : formatNumber(v))} allowDecimals={false} />
                  <YAxis yAxisId="x" orientation="right" hide allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => [name === c.series ? show(Number(value)) : formatNumber(Number(value)), String(name)]}
                  />
                  <Bar yAxisId="x" dataKey="extra" name={c.extra} fill={tab === "payments" ? "var(--danger)" : "var(--accent)"} fillOpacity={0.35} radius={[3, 3, 0, 0]} isAnimationActive={!reduced} />
                  <Area yAxisId="v" type="monotone" dataKey="value" name={c.series} stroke="var(--primary)" strokeWidth={2} fill={`url(#g${gid})`} isAnimationActive={!reduced} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" aria-hidden /> {c.series}</span>
              <span className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-sm opacity-60", tab === "payments" ? "bg-danger" : "bg-accent")} aria-hidden /> {c.extra}</span>
              {tab === "payments" && <span>From payment events recorded since this tracking began.</span>}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
