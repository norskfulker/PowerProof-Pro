"use client";

import Link from "next/link";
import { GuardedLink } from "@/components/plan/plan-context";
import { ListChecks, Package, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { StatusPill } from "@/components/pp/status-pill";
import { PageHeader } from "@/components/pp/page-header";
import { useGettingStarted } from "@/components/getting-started/getting-started-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceCell, QuickActions } from "@/components/dashboard/bento";
import { NeedsAttention, stockOf } from "@/components/dashboard/attention";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { MetricsCard } from "@/components/dashboard/metrics-card";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getBalance, getPlan, getProducts } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import type { Product } from "@/lib/types";

/** The most recently changed products, scrolling inside the card when there are many */
function LatestProducts({ products }: { products: Product[] | undefined }) {
  const recent = [...(products ?? [])].sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt)).slice(0, 8);
  return (
    <section aria-labelledby="products-title" className="flex min-h-0 flex-col rounded-card border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 id="products-title" className="font-display text-lg">Latest products</h2>
        <Link href="/catalog/products" className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11">All products</Link>
      </header>
      {products && products.length > 0 ? (
        <ul className="max-h-[26rem] divide-y overflow-y-auto">
          {recent.map((p) => (
            <li key={p.id}>
              <Link href={`/catalog/products/${p.id}`} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-muted/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.title}</span>
                  <span className="block text-xs text-muted-foreground">{formatNumber(p.salesCount)} sold{stockOf(p) !== undefined ? ` · ${stockOf(p)} in stock` : ""}</span>
                </span>
                <MoneyText value={p.price} className="text-sm font-semibold" />
                <StatusPill status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : products ? (
        <EmptyState compact className="m-4 border-0" icon={Package} title="No products yet." body="Add your first product to start selling." action={<Button asChild><GuardedLink kind="products" href="/catalog/products/new"><Plus aria-hidden /> Add product</GuardedLink></Button>} />
      ) : (
        <Skeleton className="m-4 h-40 rounded-card" />
      )}
    </section>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/**
 * The dashboard, top to bottom: the two quick actions, one card for Sales, Visitors and Payments
 * (1D, 7D, 30D) beside the balance, what needs attention, then live orders and the latest products
 * side by side. Detail lives on the Analytics, Orders and Live activity pages.
 */
export default function DashboardPage() {
  const store = useCurrentStore();
  const { openDrawer } = useGettingStarted();
  const balance = useApi(getBalance, [], { live: true });
  const products = useApi(() => getProducts(), [], { live: true });
  const plan = useApi(getPlan, []);
  const firstName = store.data?.ownerName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        actions={
          <Button type="button" variant="secondary" onClick={openDrawer}>
            <ListChecks aria-hidden /> Getting started
          </Button>
        }
      />

      {plan.data?.plan.status === "trial" && plan.data.plan.trialEndsAt && (
        <div className="mb-6 flex flex-col gap-3 rounded-card border border-accent/40 bg-accent-soft px-5 py-4 sm:flex-row sm:items-center">
          <Sparkles className="size-5 shrink-0 text-accent-ink" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>Free month</strong> until {formatDate(plan.data.plan.trialEndsAt)}. Then ₹1,999/month. You only pay 3% per sale until then.
          </p>
          <Link href="/settings/billing" className="text-sm font-semibold text-accent-ink underline underline-offset-4">
            See plan
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-8">
        <QuickActions store={store.data} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <MetricsCard />
          <BalanceCell balance={balance.data} className="xl:self-start" />
        </div>

        <NeedsAttention products={products.data} storeId={store.data?.id ?? "current"} />

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <LiveFeed />
          <LatestProducts products={products.data} />
        </div>
      </div>
    </>
  );
}
