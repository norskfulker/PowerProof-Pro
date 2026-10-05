"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartCard, RevenueBars, ShareBars } from "@/components/pp/chart-card";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { Glance } from "@/components/dashboard/glance";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { useApi } from "@/hooks/use-api";
import { getBalance, getIntegrations, getPayoutMethods, getPlan, getProducts, getStore, getSummary } from "@/lib/api";
import { formatDate, sourceLabel } from "@/lib/format";
import type { RangeKey } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const store = useApi(getStore, [], { live: true });
  const summary = useApi(() => getSummary(range), [range], { live: true });
  const balance = useApi(getBalance, [], { live: true });
  const products = useApi(() => getProducts(), [], { live: true });
  const methods = useApi(getPayoutMethods, []);
  const integrations = useApi(getIntegrations, []);
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
              <Link href="/products/new">
                <Plus aria-hidden /> Add product
              </Link>
            </Button>
          </>
        }
      />

      {plan.data?.plan.status === "trial" && (
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
        {isNew && store.data && (
          <GettingStarted
            storeName={store.data.name}
            items={[
              { label: "Add a product", body: "Upload a file, paste a link or build a page.", href: "/products/new", done: (products.data?.length ?? 0) > 0 },
              { label: "Publish it", body: "Drafts don't show on your store.", href: "/products", done: !!products.data?.some((p) => p.status === "published") },
              { label: "Add your bank account", body: "So money has somewhere to go.", href: "/payouts", done: !!methods.data?.some((m) => m.kind === "bank") },
              { label: "Connect analytics", body: "Google Analytics or Clarity, one ID each.", href: "/integrations", done: !!integrations.data?.some((i) => i.connected) },
            ]}
          />
        )}

        {!isNew && (
          <section aria-labelledby="glance-h" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="glance-h" className="text-xl">At a glance</h2>
              <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
                <TabsList>
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="7d">7 days</TabsTrigger>
                  <TabsTrigger value="30d">30 days</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Glance summary={summary.data} balance={balance.data} loading={summary.loading && !summary.data} error={summary.error} onRetry={summary.reload} />
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <QuickActions store={store.data} />
            {!isNew && (
              <ChartCard
                title="Revenue"
                description={range === "today" ? "Today, by hour" : range === "7d" ? "Last 7 days" : "Last 30 days"}
                loading={summary.loading && !summary.data}
                error={summary.error}
                onRetry={summary.reload}
                empty={summary.data?.revenue.amount === 0}
                emptyText="No sales in this range yet. They'll stack up here."
              >
                {summary.data && <RevenueBars data={summary.data.series} />}
              </ChartCard>
            )}
            {!isNew && (
              <div className="grid gap-6 md:grid-cols-2">
                <ChartCard title="Top products" loading={summary.loading && !summary.data} height={180} empty={summary.data?.topProducts.length === 0}>
                  <ol className="flex flex-col gap-3">
                    {summary.data?.topProducts.slice(0, 4).map((p, i) => (
                      <li key={p.productId} className="flex items-center gap-3 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                        <Link href={`/products/${p.productId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                          {p.title}
                        </Link>
                        <MoneyText value={p.revenue} mono />
                      </li>
                    ))}
                  </ol>
                </ChartCard>
                <ChartCard title="Where buyers come from" loading={summary.loading && !summary.data} height={180} empty={summary.data?.sources.length === 0}>
                  {summary.data && <ShareBars rows={summary.data.sources.slice(0, 4).map((s) => ({ label: sourceLabel(s.source), value: s.visitors, share: s.share }))} />}
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
