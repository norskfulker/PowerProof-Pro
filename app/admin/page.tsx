"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatCard } from "@/components/pp/stat-card";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getCreators, getDisputes, getPlatformStats } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";

export default function AdminOverviewPage() {
  const stats = useApi(getPlatformStats, []);
  const creators = useApi(() => getCreators(), []);
  const disputes = useApi(getDisputes, []);
  const s = stats.data;

  if (stats.error) return <ErrorState message={stats.error} onRetry={stats.reload} />;

  const needs = [
    { href: "/admin/orders/disputed", label: "Open disputes", value: s?.openDisputes, note: "Gateway deadlines apply" },
    { href: "/admin/money/payouts", label: "Payouts to check", value: s?.queuedPayouts, note: "Queued or on hold" },
    { href: "/admin/moderation/flags", label: "Flagged content", value: s?.openFlags, note: "Waiting for a decision" },
  ];

  return (
    <>
      <PageHeader title="Platform today" description="The whole business on one page. Numbers are last 30 days unless noted." />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard label="GMV, 30 days" loading={!s} value={s && <MoneyText value={s.gmv30d} compact />} emphasis />
        <StatCard label="PowerProof revenue" loading={!s} value={s && <MoneyText value={s.revenue30d} compact />} hint="3% of GMV" />
        <StatCard label="Creators" loading={!s} value={s?.creators} hint={s && `${s.activeCreators} active or in trial`} />
        <StatCard label="Needs a look" loading={!s} value={s && s.openDisputes + s.queuedPayouts + s.openFlags} hint="disputes, payouts, flags" />
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {needs.map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="group flex items-center gap-4 rounded-card border bg-surface p-5 hover:border-border-strong">
              <span className="font-display text-4xl text-accent-strong">{n.value ?? "–"}</span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{n.label}</span><span className="text-sm text-muted-foreground">{n.note}</span></span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="new-h" className="rounded-card border bg-surface">
          <h2 id="new-h" className="border-b px-5 py-4 font-sans text-base font-semibold tracking-normal">Newest creators</h2>
          {!creators.data ? <Skeleton className="m-5 h-40" /> : (
            <ul className="divide-y">
              {[...creators.data].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1"><span className="block font-medium">{c.storeName}</span><span className="text-muted-foreground">{c.ownerName} · {c.city}</span></span>
                  <StatusPill status={c.plan} />
                  <span className="w-20 text-right font-mono text-xs text-muted-foreground">{timeAgo(c.joinedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="due-h" className="rounded-card border bg-surface">
          <h2 id="due-h" className="border-b px-5 py-4 font-sans text-base font-semibold tracking-normal">Disputes due soon</h2>
          {!disputes.data ? <Skeleton className="m-5 h-40" /> : (
            <ul className="divide-y">
              {disputes.data.filter((d) => d.status === "open" || d.status === "under_review").sort((a, b) => a.dueBy.localeCompare(b.dueBy)).map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1"><span className="block font-medium">{d.storeName} · <span className="font-mono">{d.orderNumber}</span></span><span className="text-muted-foreground">Respond by {formatDate(d.dueBy)}</span></span>
                  <MoneyText value={d.amount} mono />
                  <StatusPill status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
