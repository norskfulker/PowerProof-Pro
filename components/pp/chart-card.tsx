"use client";

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

const axis = { fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" };

function TooltipBox({
  active,
  payload,
  label,
  kind,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
  kind: "money" | "count";
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border bg-surface px-3 py-2 text-sm shadow-pop">
      <p className="eyebrow">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-semibold tabular">
          {kind === "money" ? formatMoney({ amount: Math.round(p.value * 100), currency: "INR" }) : formatNumber(p.value)}{" "}
          <span className="font-normal text-muted-foreground">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueBars({ data, height = 240 }: { data: { label: string; revenue: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} tick={axis} width={48} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
        <Tooltip cursor={{ fill: "var(--muted)" }} content={<TooltipBox kind="money" />} />
        <Bar dataKey="revenue" name="revenue" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VisitorsArea({ data, height = 240 }: { data: { label: string; visitors: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} tick={axis} width={48} />
        <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={<TooltipBox kind="count" />} />
        <Area type="monotone" dataKey="visitors" name="visitors" stroke="var(--chart-2)" strokeWidth={2} fill="var(--accent-soft)" />
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
            <span className="font-medium capitalize">{r.label}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {format(r.value)} · {r.share.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-chart-3")}
              style={{ width: `${Math.max(2, r.share)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
