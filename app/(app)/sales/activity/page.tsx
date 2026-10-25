"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, Eye, HelpCircle, Package, Receipt, ShoppingCart, Star, Store, Users, type LucideIcon, CreditCard } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { LiveStatusBadge } from "@/components/pp/live-status";
import { PageHeader } from "@/components/pp/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveStore } from "@/hooks/use-live-store";
import { useNow } from "@/hooks/use-now";
import { ACTIVITY_CATEGORIES, getStoreActivity, type ActivityCategory, type ActivityItem } from "@/lib/api/activity";
import { formatNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityCategory, LucideIcon> = {
  visitors: Users,
  products: Eye,
  cart: ShoppingCart,
  checkout: Receipt,
  orders: Package,
  payments: CreditCard,
  reviews: Star,
  support: HelpCircle,
  store: Store,
};
const TONE: Record<NonNullable<ActivityItem["tone"]>, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-muted text-muted-foreground",
};
const RANGES = [
  { value: "60", label: "Last hour" },
  { value: "1440", label: "Last 24 hours" },
  { value: "10080", label: "Last 7 days" },
];

/**
 * Live activity: what's happening in the store right now. Visitors and page views, product views,
 * add-to-cart, checkouts started, completed and abandoned, orders and their fulfilment, payment
 * problems, reviews, buyer questions and product changes, newest first, as they happen. Everything
 * comes from recorded events (storefront tracking is cookieless and skips Do Not Track), so nothing
 * here is simulated; visitors are anonymous sessions, never people.
 */
export default function LiveActivityPage() {
  const [range, setRange] = useState("1440");
  const [only, setOnly] = useState<ActivityCategory | "all">("all");
  // Worked out when the request runs, so each live refresh looks back from now
  const { data, loading, error, reload } = useApi(() => getStoreActivity(new Date(Date.now() - Number(range) * 60_000).toISOString()), [range]);
  const live = useLiveStore(["store_events", "orders", "payment_events", "order_events"], reload, { throttleMs: 2000 });
  // "2 min ago" stays honest
  useNow();

  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.items.map((i) => i.id));
      return;
    }
    const arrivals = data.items.filter((i) => !seen.current!.has(i.id)).map((i) => i.id);
    arrivals.forEach((id) => seen.current!.add(id));
    if (!arrivals.length) return;
    const a = setTimeout(() => setFresh(new Set(arrivals)), 0);
    const b = setTimeout(() => setFresh(new Set()), 4000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [data]);

  const items = (data?.items ?? []).filter((i) => only === "all" || i.category === only);
  const c = data?.counts;
  const conversion = c && c.checkouts ? Math.round((c.orders / Math.max(c.checkouts, 1)) * 100) : null;
  const stats: { label: string; value: React.ReactNode; hint?: string }[] = [
    { label: "Active now", value: data ? formatNumber(data.activeNow) : undefined, hint: "Visitors in the last 5 minutes" },
    { label: "Visitors", value: c ? formatNumber(c.visitors) : undefined },
    { label: "Added to cart", value: c ? formatNumber(c.carts) : undefined },
    { label: "Checkouts", value: c ? formatNumber(c.checkouts) : undefined, hint: conversion !== null ? `${conversion}% became orders` : undefined },
    { label: "Orders", value: c ? formatNumber(c.orders) : undefined },
  ];

  return (
    <>
      <PageHeader title="Live activity" actions={<LiveStatusBadge status={live} />} />
      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-card border bg-border sm:grid-cols-5" aria-label="Activity summary">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 bg-surface px-4 py-3">
            <dt className="eyebrow">{s.label}</dt>
            <dd className="font-display text-xl font-bold tabular-nums">{s.value === undefined ? <Skeleton className="h-6 w-10" /> : s.value}</dd>
            {s.hint && <dd className="text-xs text-muted-foreground">{s.hint}</dd>}
          </div>
        ))}
      </dl>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={only} onValueChange={(v) => setOnly(v as ActivityCategory | "all")}>
          <SelectTrigger className="w-48" aria-label="Event type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            {ACTIVITY_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {live === "offline" && <p className="text-sm text-warning-ink" role="status">Live connection lost. Refreshing every 30 seconds until it&apos;s back.</p>}
      </div>

      <section aria-label="Activity feed" className="overflow-hidden rounded-card border bg-surface">
        {error ? (
          <ErrorState className="m-4" message={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="flex flex-col gap-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : items.length ? (
          <ul className="divide-y" aria-live="polite" aria-relevant="additions">
            {items.map((it) => {
              const Icon = ICONS[it.category];
              const body = (
                <>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{it.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ACTIVITY_CATEGORIES.find((x) => x.value === it.category)?.label}
                      {it.detail ? ` · ${it.detail}` : ""}
                    </span>
                  </span>
                  {it.status && <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold sm:inline", TONE[it.tone ?? "neutral"])}>{it.status}</span>}
                  <time dateTime={it.at} className="w-20 shrink-0 text-right text-xs text-muted-foreground">{timeAgo(it.at)}</time>
                  {it.href && <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                </>
              );
              const cls = cn("flex items-center gap-3 px-4 py-3 transition-colors duration-700", fresh.has(it.id) && "bg-accent-soft");
              return <li key={it.id}>{it.href ? <Link href={it.href} className={cn(cls, "hover:bg-muted/50")}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
            })}
          </ul>
        ) : (
          <EmptyState compact className="m-4 border-0" icon={Activity} title="Nothing in this period yet." body="Visits, carts, checkouts, orders, reviews and questions appear here the moment they happen." />
        )}
      </section>
      <p className="mt-3 text-xs text-muted-foreground">
        Visitors are counted per browser session, without cookies, and Do Not Track is respected, so a visitor is never a named person. &ldquo;Added to cart&rdquo; is counted from today on. Support conversations outside buyer questions aren&apos;t connected yet.
      </p>
    </>
  );
}
