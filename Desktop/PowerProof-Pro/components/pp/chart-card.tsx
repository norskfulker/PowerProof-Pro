"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useCallback, useId, useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
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
          <h2 className="text-base">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div style={{ minHeight: empty && !emptyChart && !loading && !error ? undefined : height }} className="flex flex-1 flex-col">
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
          <div className="grid min-h-28 flex-1 place-items-center rounded-media bg-surface-sunken p-6 text-center text-sm text-muted-foreground">
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
  // The gradient wash under a line is the same series: show each name once
  payload = payload.filter((p, i, all) => p.name !== "value" && all.findIndex((q) => q.name === p.name) === i);
  if (!payload.length) return null;
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

const TONE = { revenue: "var(--chart-revenue)", orders: "var(--chart-orders)", visitors: "var(--chart-visitors)" } as const;

/**
 * A change-over-time chart: a 2px line with a soft shadow under it, an optional gradient wash below,
 * and dots (every point on short ranges, just the latest on long ones, plus the one under the
 * pointer, each with a ring in the surface colour). One series, one axis, a crosshair tooltip.
 */
export function TrendChart({
  data,
  tone = "revenue",
  kind = "count",
  variant = "area",
  height = 240,
  name,
  currency,
  compareName,
}: {
  /** `compare`: the same point in the period it's compared with, drawn as a quiet dashed line */
  data: { label: string; value: number; compare?: number }[];
  tone?: keyof typeof TONE;
  kind?: "money" | "count";
  /** area: line over a gradient wash; line: the line alone */
  variant?: "area" | "line";
  height?: number;
  name: string;
  currency?: CurrencyCode;
  /** What the dashed line is, in the tooltip ("last period") */
  compareName?: string;
}) {
  const still = useReducedMotion();
  const comparing = data.some((d) => d.compare !== undefined);
  const id = useId().replace(/:/g, "");
  const color = TONE[tone];
  const everyDot = data.length <= 14;
  const last = data.length - 1;
  // Stable between renders: a new function on hover would restart the line's draw-in animation
  const dot = useCallback(
    (p: { cx?: number; cy?: number; index?: number }) =>
      (everyDot || p.index === last) && p.cx != null && p.cy != null ? (
        <circle key={`d-${p.index}`} cx={p.cx} cy={p.cy} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
      ) : (
        <g key={`d-${p.index}`} />
      ),
    [everyDot, last, color]
  );
  const activeDot = useMemo(() => ({ r: 6, fill: color, stroke: "var(--surface)", strokeWidth: 2.5 }), [color]);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 20, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="70%" stopColor={color} stopOpacity={0.06} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <filter id={`shadow-${id}`} x="-10%" y="-40%" width="120%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor={color} floodOpacity="0.35" />
          </filter>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} interval="preserveStartEnd" minTickGap={16} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={axis}
          width={48}
          domain={EMPTY_SAFE}
          allowDecimals={kind === "money"}
          tickFormatter={(v: number) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
        />
        <Tooltip cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} content={<TooltipBox kind={kind} currency={currency} />} />
        {comparing && (
          <Line isAnimationActive={!still} type="monotone" dataKey="compare" name={compareName ?? "before"} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
        )}
        {variant === "area" && <Area isAnimationActive={!still} type="monotone" dataKey="value" stroke="none" fill={`url(#fill-${id})`} tooltipType="none" activeDot={false} />}
        <Line
          isAnimationActive={!still}
          type="monotone"
          dataKey="value"
          name={name}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#shadow-${id})`}
          dot={dot}
          activeDot={activeDot}
        />
      </ComposedChart>
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
          <div className="h-2 rounded-full bg-muted" aria-hidden>
            {/* The leader is the full-strength hue; the rest are a lighter step of it */}
            <div
              className={cn("relative h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", r.value > 0 && "after:absolute after:top-1/2 after:right-0 after:size-3 after:translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border-2 after:border-surface after:bg-[var(--bar)] after:content-['']")}
              style={{
                width: r.value > 0 ? `${Math.max(2, r.share)}%` : 0,
                "--bar": i === 0 ? "var(--chart-revenue)" : "color-mix(in oklab, var(--chart-revenue) 55%, var(--surface))",
                background: "linear-gradient(90deg, color-mix(in oklab, var(--bar) 35%, transparent), var(--bar))",
              } as React.CSSProperties}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
