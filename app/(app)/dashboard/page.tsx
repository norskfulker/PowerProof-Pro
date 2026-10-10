"use client";

import { useState } from "react";
import Link from "next/link";
import { GuardedLink } from "@/components/plan/plan-context";
import { ExternalLink, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/pp/segmented";
import { ChartCard, RevenueBars, ShareBars, VisitorsArea } from "@/components/pp/chart-card";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { GettingStartedCard } from "@/components/getting-started/getting-started-card";
import { useGettingStarted } from "@/components/getting-started/getting-started-provider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Glance } from "@/components/dashboard/glance";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SubmissionsCard } from "@/components/leads/form-responses";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getBalance, getLeads, getPlan, getProducts, getSummary } from "@/lib/api";
import { formatDate, sourceLabel } from "@/lib/format";
import type { RangeKey, Store } from "@/lib/types";

const SOURCES = ["Direct", "Search", "Social", "Email", "Other"];
const FUNNEL = ["Visits", "Viewed a product", "Started checkout", "Paid"];

type Summary = ReturnType<typeof useApi<Awaited<ReturnType<typeof getSummary>>>>;
type BalanceState = ReturnType<typeof useApi<Awaited<ReturnType<typeof getBalance>>>>;

/**
 * The dashboard in three sections you open and close: Getting started (until setup is done),
 * Operations (what needs doing today) and Analytics (how it's going).
 */
/** When a date range starts */
function rangeStart(range: RangeKey, now: number) {
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return now - { "7d": 7, "30d": 30, "90d": 90 }[range] * 86_400_000;
}

function DashboardSections({ isNew, hasLive, range, setRange, summary, balance, store }: { isNew: boolean; hasLive: boolean; range: RangeKey; setRange: (r: RangeKey) => void; summary: Summary; balance: BalanceState; store: Store | undefined }) {
  const { checklist } = useGettingStarted();
  // What people sent through the store's forms, bookings and newsletter
  const leads = useApi(getLeads, [], { live: true });
  const [now] = useState(() => Date.now());
  // Not rendered until the checklist is known, so the sections open the right way from the start
  if (!checklist) return <Skeleton className="h-64 rounded-card" />;
  const settingUp = !checklist.dismissed && !checklist.complete;
  return (
    <Accordion type="multiple" defaultValue={settingUp ? ["getting-started", "operations"] : ["operations", "analytics"]} className="rounded-card border bg-surface px-5">
      <AccordionItem value="getting-started" id="getting-started">
        <AccordionTrigger className="min-h-14 items-center font-display text-xl">
          <span className="flex-1">Further steps</span>
          <span className="shrink-0 font-sans text-sm font-normal text-muted-foreground">{checklist.dismissed ? "Hidden" : checklist.complete ? "All done" : `${checklist.percent}%`}</span>
        </AccordionTrigger>
        <AccordionContent>
          {checklist.dismissed ? <p className="text-sm text-muted-foreground">You&apos;ve hidden the checklist. Everything required was done.</p> : <GettingStartedCard bare />}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="operations" id="operations">
        <AccordionTrigger className="min-h-14 font-display text-xl">Operations</AccordionTrigger>
        <AccordionContent>
          <QuickActions store={store} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="analytics" id="analytics" className="border-b-0">
        <AccordionTrigger className="min-h-14 font-display text-xl">Analytics</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{isNew ? "Nothing sold yet. Your numbers appear here." : "Sales, products and visitors for the period you pick."}</p>
              <Segmented label="Date range" value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "90d", label: "90 days" }]} />
            </div>
            <Glance summary={summary.data} balance={balance.data} loading={summary.loading && !summary.data} error={summary.error} onRetry={summary.reload} />
            <div className={hasLive ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : undefined}>
              <ChartCard
                title="Revenue"
                description={{ today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" }[range]}
                loading={summary.loading && !summary.data}
                error={summary.error}
                onRetry={summary.reload}
              >
                {summary.data && <RevenueBars data={summary.data.series} currency={summary.data.revenue.currency} />}
              </ChartCard>
              {/* Orders as they land: appears once there is a live product to sell */}
              {hasLive && <LiveFeed />}
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ChartCard
                title="Top products"
                loading={summary.loading && !summary.data}
                height={180}
                empty={summary.data?.topProducts.length === 0}
                emptyText="No sales yet"
                emptyChart={<ShareBars rows={[1, 2, 3, 4].map((n) => ({ label: `#${n}`, value: 0, share: 0 }))} />}
              >
                <ol className="flex flex-col gap-3">
                  {summary.data?.topProducts.slice(0, 4).map((p, i) => (
                    <li key={p.productId} className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                      <Link href={`/catalog/products/${p.productId}`} className="flex min-w-0 flex-1 items-center truncate font-medium hover:underline pointer-coarse:min-h-11">{p.title}</Link>
                      <MoneyText value={p.revenue} mono />
                    </li>
                  ))}
                </ol>
              </ChartCard>
              <ChartCard title="Where buyers come from" height={180} loading={summary.loading && !summary.data} empty={!summary.data?.sources.length} emptyText="No visits recorded yet" emptyChart={<ShareBars rows={SOURCES.map((label) => ({ label, value: 0, share: 0 }))} />}>
                <ShareBars rows={(summary.data?.sources ?? []).map((s) => ({ label: sourceLabel(s.source), value: s.visitors, share: s.share }))} />
              </ChartCard>
              <ChartCard title="Visitors" height={180} loading={summary.loading && !summary.data} empty={!summary.data?.visitors} emptyText="No visits recorded yet" emptyChart={<VisitorsArea height={180} data={(summary.data?.series ?? []).map((p) => ({ label: p.label, visitors: 0 }))} />}>
                <VisitorsArea height={180} data={(summary.data?.series ?? []).map((p) => ({ label: p.label, visitors: p.visitors ?? 0 }))} />
              </ChartCard>
              <ChartCard title="Funnel" description="Visit to payment" height={180} loading={summary.loading && !summary.data} empty={!summary.data?.funnel[0]?.value} emptyText="No visits recorded yet" emptyChart={<ShareBars rows={FUNNEL.map((label) => ({ label, value: 0, share: 0 }))} />}>
                <ShareBars rows={(summary.data?.funnel ?? []).map((f) => ({ label: f.label, value: f.value, share: summary.data!.funnel[0].value ? (f.value / summary.data!.funnel[0].value) * 100 : 0 }))} />
              </ChartCard>
            </div>
            <SubmissionsCard leads={leads.data} since={rangeStart(range, now)} loading={leads.loading} />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const store = useCurrentStore();
  const summary = useApi(() => getSummary(range), [range], { live: true });
  const balance = useApi(getBalance, [], { live: true });
  const products = useApi(() => getProducts(), [], { live: true });
  const plan = useApi(getPlan, []);

  const isNew = products.data !== undefined && balance.data !== undefined && products.data.every((p) => p.salesCount === 0) && balance.data.available.amount === 0 && balance.data.pending.amount === 0;
  const firstName = store.data?.ownerName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description={isNew ? "Your store is live. Get your sales rollin!" : "Here's how today is going."}
        actions={
          <>
            {store.data && (
              <Button asChild variant="secondary">
                <Link href={`/s/${store.data.slug}`} target="_blank">
                  View store <ExternalLink aria-hidden />
                </Link>
              </Button>
            )}
            <Button asChild>
              <GuardedLink kind="products" href="/catalog/products/new" data-coach="new-product">
                <Plus aria-hidden /> Add product
              </GuardedLink>
            </Button>
          </>
        }
      />

      {plan.data?.plan.status === "trial" && plan.data.plan.trialEndsAt && (
        <div className="mb-6 flex flex-col gap-3 rounded-card border border-accent/40 bg-accent-soft px-5 py-4 sm:flex-row sm:items-center">
          <Sparkles className="size-5 shrink-0 text-accent-ink" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>Free month</strong> until {formatDate(plan.data.plan.trialEndsAt)}. Then $20/month. You only pay 3% per sale until then.
          </p>
          <Link href="/settings/billing" className="text-sm font-semibold text-accent-ink underline underline-offset-4">
            See plan
          </Link>
        </div>
      )}

      <DashboardSections
        isNew={isNew}
        hasLive={products.data?.some((p) => p.status === "published") ?? false}
        range={range}
        setRange={setRange}
        summary={summary}
        balance={balance}
        store={store.data}
      />
    </>
  );
}
