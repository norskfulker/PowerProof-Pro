"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, Copy, ExternalLink, Wallet } from "lucide-react";
import { useState } from "react";
import { GlassIcon } from "@/components/pp/glass-icon";
import { MoneyText } from "@/components/pp/money-text";
import { copyText } from "@/components/pp/copy-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getSummary, markLinkShared } from "@/lib/api";
import { formatNumber, SITE_URL } from "@/lib/format";
import type { Balance, Store, Summary } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A bento cell: crisp card, depth on hover, optional gradient */
export function Cell({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative overflow-hidden rounded-card border bg-surface p-5 shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

function Delta({ v }: { v: number | null | undefined }) {
  if (v == null) return null;
  const up = v >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold", up ? "bg-white/15" : "bg-black/20")}>
      {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
      <span className="sr-only">{up ? "Up" : "Down"}</span>
      {Math.abs(v).toFixed(0)}%
    </span>
  );
}

/** Seven days of revenue as a small line, drawn on the gradient */
function Spark({ values }: { values: number[] }) {
  // Nothing sold this week: a flat line would only look like a divider
  if (values.length < 2 || !values.some((v) => v > 0)) return null;
  const max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 34 - (v / max) * 30] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,36 L0,36 Z`} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="#ffffff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** The big tile: today's money, on the deep gradient, with the week's line under it */
export function TodayCell({ summary, loading, className }: { summary?: Summary; loading: boolean; className?: string }) {
  const week = useApi(() => getSummary("7d"), [], { live: true });
  const s = summary;
  return (
    <div className={cn("grain bg-mesh-forest relative flex flex-col overflow-hidden rounded-card p-6 shadow-deep", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.06em] text-white/75 uppercase">Today</p>
        <Link href="/analytics" className="inline-flex items-center gap-1 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white backdrop-blur hover:bg-white/20">
          Analytics <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {loading || !s ? (
        <Skeleton className="mt-4 h-12 w-48 bg-white/15" />
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <MoneyText value={s.revenue} className="font-display text-[clamp(2.25rem,4vw,3.25rem)] leading-none font-bold tracking-[-0.035em] text-white" />
          <Delta v={s.deltas.revenue} />
        </div>
      )}
      <p className="mt-2 text-sm text-white/75">Revenue, vs yesterday</p>
      <div className="mt-auto pt-6">
        <Spark values={(week.data?.series ?? []).map((p) => p.revenue)} />
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Sales", s ? formatNumber(s.sales) : "—", s?.deltas.sales],
            ["Visitors", s?.visitors == null ? "—" : formatNumber(s.visitors), s?.deltas.visitors],
            ["Conversion", s?.conversion == null ? "—" : `${s.conversion.toFixed(1)}%`, s?.deltas.conversion],
          ].map(([k, v, d]) => (
            <div key={k as string} className="rounded-control bg-white/10 px-3 py-2 backdrop-blur-sm">
              <dt className="text-[0.6875rem] font-semibold tracking-[0.04em] text-white/70 uppercase">{k}</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-display text-lg font-bold text-white tabular">
                {v} <Delta v={d as number | null | undefined} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Money ready to take out, on the warm gradient */
export function BalanceCell({ balance, className }: { balance?: Balance; className?: string }) {
  return (
    <div className={cn("grain bg-mesh-brass relative flex flex-col overflow-hidden rounded-card border p-5 shadow-card", className)}>
      <div className="flex items-center justify-between">
        <GlassIcon icon={Wallet} tone="amber" />
        <Button asChild size="sm" variant="brass"><Link href="/sales/payouts/balance?withdraw=1">Withdraw</Link></Button>
      </div>
      <p className="eyebrow mt-4">Ready to withdraw</p>
      {balance ? <MoneyText value={balance.available} className="mt-1 font-display text-3xl font-bold tracking-[-0.03em]" /> : <Skeleton className="mt-2 h-8 w-28" />}
      {balance && balance.pending.amount > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">+ <MoneyText value={balance.pending} /> pending</p>
      )}
    </div>
  );
}

/** The store's link, one tap to copy */
export function ShareCell({ store, className }: { store?: Store; className?: string }) {
  const [done, setDone] = useState(false);
  const url = store ? `${SITE_URL}/${store.slug}` : "";
  return (
    <Cell className={cn("grain bg-mesh-dawn flex flex-col", className)}>
      <GlassIcon icon={Copy} tone="sky" />
      <p className="eyebrow mt-4">Your store link</p>
      <p className="mt-1 mb-3 truncate font-medium">{url || "…"}</p>
      <div className="mt-auto flex gap-2 max-lg:mt-4">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!store}
        data-coach="share-link"
        onClick={async () => {
          if (store && (await copyText(`https://${url}`, "Store link copied"))) {
            markLinkShared();
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          }
        }}
      >
        {done ? <Check aria-hidden /> : <Copy aria-hidden />} {done ? "Copied" : "Copy link"}
      </Button>
      {store && (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/s/${store.slug}`} target="_blank">View <ExternalLink aria-hidden /></Link>
        </Button>
      )}
      </div>
    </Cell>
  );
}
