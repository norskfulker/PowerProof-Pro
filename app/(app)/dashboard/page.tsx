"use client";

import { useState } from "react";
import Link from "next/link";
import { GuardedLink } from "@/components/plan/plan-context";
import { ExternalLink, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/pp/segmented";
import { ChartCard, RevenueBars } from "@/components/pp/chart-card";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { GettingStartedCard } from "@/components/getting-started/getting-started-card";
import { Glance } from "@/components/dashboard/glance";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getBalance, getPlan, getProducts, getSummary } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { RangeKey } from "@/lib/types";

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
        eyebrow={formatDate(new Date().toISOString())}
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description={isNew ? "Your store is live. Here's what's left before the first sale." : "Here's how today is going."}
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

      <div className="flex flex-col gap-6">
        <GettingStartedCard />

        {(
          <section aria-labelledby="glance-h" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="glance-h" className="text-xl">Sales and analytics</h2>
              <Segmented label="Date range" value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "90d", label: "90 days" }]} />
            </div>
            <Glance summary={summary.data} balance={balance.data} loading={summary.loading && !summary.data} error={summary.error} onRetry={summary.reload} />
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <QuickActions store={store.data} />
            {(
              <ChartCard
                title="Revenue"
                description={{ today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" }[range]}
                loading={summary.loading && !summary.data}
                error={summary.error}
                onRetry={summary.reload}
                empty={summary.data?.revenue.amount === 0}
                emptyText="No sales in this range yet. They'll stack up here."
              >
                {summary.data && <RevenueBars data={summary.data.series} />}
              </ChartCard>
            )}
            {(
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ChartCard title="Top products" loading={summary.loading && !summary.data} height={180} empty={summary.data?.topProducts.length === 0}>
                  <ol className="flex flex-col gap-3">
                    {summary.data?.topProducts.slice(0, 4).map((p, i) => (
                      <li key={p.productId} className="flex items-center gap-3 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                        <Link href={`/catalog/products/${p.productId}`} className="flex pointer-coarse:min-h-11 min-w-0 flex-1 items-center truncate font-medium hover:underline">
                          {p.title}
                        </Link>
                        <MoneyText value={p.revenue} mono />
                      </li>
                    ))}
                  </ol>
                </ChartCard>
                <ChartCard title="Where buyers come from" loading={summary.loading && !summary.data} height={180} empty emptyText="No data yet. Visitor tracking isn't connected.">
                  {null}
                </ChartCard>
              </div>
            )}
            {(
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ChartCard title="Visitors" description="Visits aren't tracked yet" loading={summary.loading && !summary.data} height={180} empty emptyText="No data yet. Visitor tracking isn't connected.">
                  {null}
                </ChartCard>
                <ChartCard title="Funnel" description="Visit to payment" loading={summary.loading && !summary.data} height={180} empty emptyText="No data yet. Visitor tracking isn't connected.">
                  {null}
                </ChartCard>
              </div>
            )}
          </div>
          <LiveFeed />
        </div>
      </div>
    </>
  );
}
