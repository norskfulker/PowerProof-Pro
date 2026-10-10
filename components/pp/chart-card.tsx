"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorState } from "./empty-state";

export function ChartCard({
  title,
  description,
  action,
  loading,
  error,
  onRetry,
  empty,
  emptyText = "No data for this range yet.",
  emptyChart,
  className,
  children,
  height = 240,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  empty?: boolean;
  emptyText?: string;
  /** What to draw when there is no data: the same chart, empty, so the page keeps its shape */
  emptyChart?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  height?: number;
}) {
  return (
    <section className={cn("flex flex-col rounded-card border bg-surface p-5 md:p-6", className)} aria-label={title}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div style={{ minHeight: height }} className="flex flex-1 flex-col">
        {error ? (
          <ErrorState message={error} onRetry={onRetry} className="flex-1 py-6" />
        ) : loading ? (
          <Skeleton className="w-full flex-1" style={{ minHeight: height }} />
        ) : empty && emptyChart ? (
          <div className="relative flex flex-1 flex-col">
            {emptyChart}
            <p className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs text-muted-foreground">{emptyText}</p>
          </div>
        ) : empty ? (
          <div className="grid flex-1 place-items-center rounded-media bg-surface-sunken p-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** A chart with nothing in it still gets a scale */
const EMPTY_SAFE: [number, (max: number) => number] = [0, (max) => (max > 0 ? max : 4)];
const axis = { fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" };

function TooltipBox({
  active,
  payload,
  label,
  kind,
  currency = "INR",
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
  kind: "money" | "count";
  currency?: CurrencyCode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border bg-surface px-3 py-2 text-sm shadow-pop">
      <p className="eyebrow">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-semibold tabular">
          {kind === "money" ? formatMoney({ amount: Math.round(p.value * 100), currency }) : formatNumber(p.value)}{" "}
          <span className="font-normal text-muted-foreground">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueBars({ data, height = 240, currency }: { data: { label: string; revenue: number }[]; height?: number; currency?: CurrencyCode }) {
  const still = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} tick={axis} width={48} domain={EMPTY_SAFE} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
        <Tooltip cursor={{ fill: "var(--muted)" }} content={<TooltipBox kind="money" currency={currency} />} />
        <Bar isAnimationActive={!still} dataKey="revenue" name="revenue" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VisitorsArea({ data, height = 240, name = "visitors" }: { data: { label: string; visitors: number }[]; height?: number; name?: string }) {
  const still = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} tick={axis} width={48} domain={EMPTY_SAFE} allowDecimals={false} />
        <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={<TooltipBox kind="count" />} />
        <Area isAnimationActive={!still} type="monotone" dataKey="visitors" name={name} stroke="var(--chart-2)" strokeWidth={2} fill="var(--accent-soft)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal share bars: sources, funnel. Plain HTML so it's readable by screen readers. */
export function ShareBars({
  rows,
  format = (n) => formatNumber(n),
}: {
  rows: { label: string; value: number; share: number }[];
  format?: (n: number) => string;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {format(r.value)} · {r.share.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-chart-3")}
              style={{ width: r.value > 0 ? `${Math.max(2, r.share)}%` : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
