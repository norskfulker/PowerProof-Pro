"use client";

import Link from "next/link";
import { GuardedLink } from "@/components/plan/plan-context";
import { ArrowRight, ExternalLink, ListChecks, Package, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { StatusPill } from "@/components/pp/status-pill";
import { PageHeader } from "@/components/pp/page-header";
import { useGettingStarted } from "@/components/getting-started/getting-started-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionCells, BalanceCell, TodayCell } from "@/components/dashboard/bento";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { GlobalSearch } from "@/components/search/global-search";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getBalance, getNavCounts, getPlan, getProducts, getSummary } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import type { Product, Store } from "@/lib/types";
import { cn } from "@/lib/utils";

type Summary = ReturnType<typeof useApi<Awaited<ReturnType<typeof getSummary>>>>;
type BalanceState = ReturnType<typeof useApi<Awaited<ReturnType<typeof getBalance>>>>;

/** Units left for a physical product that counts stock (all variants together); undefined otherwise */
const stockOf = (p: Product) => (p.fulfilment !== "physical" || !p.trackStock ? undefined : p.variants?.length ? p.variants.reduce((t, v) => t + (v.stock ?? 0), 0) : (p.stock ?? 0));

/** One thing that needs doing, with how many and where to go */
function Todo({ href, label, count, tone = "alert" }: { href: string; label: string; count: number; tone?: "alert" | "plain" }) {
  return (
    <li>
      <Link href={href} className="flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-sm hover:bg-muted">
        <span className={cn("grid min-w-7 place-items-center rounded-full px-2 py-0.5 font-mono text-xs font-semibold", tone === "alert" ? "bg-warning-soft text-warning-ink" : "bg-primary-soft text-primary")}>{count}</span>
        <span className="flex-1 font-medium">{label}</span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * The dashboard, kept quiet: the search box, a row of shortcuts, today's money, what needs doing
 * and the latest products. Sales, buyers and visitors in detail are on the Analytics page.
 */
function DashboardSections({ summary, balance, store, products }: { summary: Summary; balance: BalanceState; store: Store | undefined; products: Product[] | undefined }) {
  const counts = useApi(() => getNavCounts("creator"), [], { live: true });
  const c = counts.data?.counts ?? {};
  const storeId = store?.id ?? "current";
  const hasLive = products?.some((p) => p.status === "published") ?? false;
  const low = (products ?? []).filter((p) => p.status === "published" && (stockOf(p) ?? 99) <= 5);
  const drafts = (products ?? []).filter((p) => p.status === "draft");
  const todos = [
    { href: "/sales/orders", label: "Open disputes to answer", count: c.orders_disputed ?? 0 },
    { href: `/store/${storeId}/design/pages/home/edit?panel=reviews`, label: "Reviews waiting for a reply", count: c.reviews_pending ?? 0 },
    { href: `/store/${storeId}/design/pages/home/edit?panel=questions`, label: "Questions to answer", count: c.questions_open ?? 0 },
    { href: "/catalog/products", label: "Products low or out of stock", count: low.length },
    { href: "/catalog/products?status=draft", label: "Drafts to finish and publish", count: drafts.length, tone: "plain" as const },
  ].filter((t) => t.count > 0);
  const recent = [...(products ?? [])].sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt)).slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <ActionCells store={store} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TodayCell summary={summary.data} loading={summary.loading && !summary.data} />
        <BalanceCell balance={balance.data} />
      </div>
      {summary.error && <ErrorState message={summary.error} onRetry={summary.reload} />}

      {/* Only when something needs doing */}
      {todos.length > 0 && (
        <section aria-labelledby="todo-title" className="flex flex-col gap-2">
          <h2 id="todo-title" className="text-base">Needs your attention</h2>
          <ul className="-mx-3 flex flex-col">{todos.map((t) => <Todo key={t.label} {...t} />)}</ul>
        </section>
      )}

      {/* Orders as they land: appears once there is a live product to sell */}
      {hasLive && <LiveFeed />}

      <section aria-labelledby="products-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="products-title" className="text-base">Latest products</h2>
          <Link href="/catalog/products" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">All products</Link>
        </div>
        {products && products.length > 0 ? (
          <ul className="divide-y rounded-card border bg-surface">
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={`/catalog/products/${p.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block text-xs text-muted-foreground">{formatNumber(p.salesCount)} sold{stockOf(p) !== undefined ? ` · ${stockOf(p)} in stock` : ""}</span>
                  </span>
                  <MoneyText value={p.price} mono />
                  <StatusPill status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : products ? (
          <EmptyState compact icon={Package} title="No products yet." body="Add your first product to start selling." action={<Button asChild><GuardedLink kind="products" href="/catalog/products/new"><Plus aria-hidden /> Add product</GuardedLink></Button>} />
        ) : (
          <Skeleton className="h-40 rounded-card" />
        )}
      </section>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const store = useCurrentStore();
  const { openDrawer } = useGettingStarted();
  // Today at a glance; other periods are on the Analytics page
  const summary = useApi(() => getSummary("today"), [], { live: true });
  const balance = useApi(getBalance, [], { live: true });
  const products = useApi(() => getProducts(), [], { live: true });
  const plan = useApi(getPlan, []);

  const firstName = store.data?.ownerName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        actions={
          <>
            {store.data && (
              <Button asChild variant="secondary">
                <Link href={`/s/${store.data.slug}`} target="_blank">
                  View store <ExternalLink aria-hidden />
                </Link>
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={openDrawer}>
              <ListChecks aria-hidden /> Getting started
            </Button>
          </>
        }
      />

      {/* The main search box: searches the workspace today, and will take AI tasks later */}
      <div className="mb-6">
        <GlobalSearch scope="creator" variant="hero" />
      </div>

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

      <DashboardSections summary={summary} balance={balance} store={store.data} products={products.data} />
    </>
  );
}
