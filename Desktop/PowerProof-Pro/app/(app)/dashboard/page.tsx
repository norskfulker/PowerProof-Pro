"use client";

import Link from "next/link";
import { GuardedLink } from "@/components/plan/plan-context";
import { ArrowRight, Package, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { StatusPill } from "@/components/pp/status-pill";
import { PageHeader } from "@/components/pp/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceCell, Cell, ShareCell, TodayCell } from "@/components/dashboard/bento";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { GoalCard } from "@/components/analytics/goal-card";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getBalance, getNavCounts, getPlan, getProducts, getSummary } from "@/lib/api";
import { formatDate } from "@/lib/format";
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
 * The dashboard, cut to what a creator acts on: today's money, what they can withdraw, their link,
 * what needs doing (only when something does), orders as they land and recent products. Everything
 * else is one click away in the sidebar.
 */
function DashboardSections({ summary, balance, store, products }: { summary: Summary; balance: BalanceState; store: Store | undefined; products: Product[] | undefined }) {
  const counts = useApi(() => getNavCounts("creator"), [], { live: true });
  const c = counts.data?.counts ?? {};
  const storeId = store?.id ?? "current";
  const hasLive = products?.some((p) => p.status === "published") ?? false;
  const low = (products ?? []).filter((p) => p.status === "published" && (stockOf(p) ?? 99) <= 5);
  const drafts = (products ?? []).filter((p) => p.status === "draft");
  const todos = [
    { href: "/sales/orders?status=disputed", label: "Disputes to answer", count: c.orders_disputed ?? 0 },
    { href: `/store/${storeId}/design/pages/home/edit?panel=reviews`, label: "Reviews to reply to", count: c.reviews_pending ?? 0 },
    { href: `/store/${storeId}/design/pages/home/edit?panel=questions`, label: "Questions to answer", count: c.questions_open ?? 0 },
    { href: "/catalog/products", label: "Low on stock", count: low.length },
    { href: "/catalog/products?status=draft", label: "Drafts to finish", count: drafts.length, tone: "plain" as const },
  ].filter((t) => t.count > 0);
  const recent = [...(products ?? [])].sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt)).slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Today" className="flex flex-col gap-4">
        {/* Today on the big gradient tile; money and the store link beside it */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TodayCell summary={summary.data} loading={summary.loading && !summary.data} className="min-h-[18rem] sm:col-span-2 lg:row-span-2" />
          <BalanceCell balance={balance.data} />
          <ShareCell store={store} />
        </div>
        {summary.error && <ErrorState message={summary.error} onRetry={summary.reload} />}
        {/* This month against the goal: only once one is set (on Analytics) */}
        <GoalCard quiet />
        {/* Only when something is waiting: an empty "all caught up" box is noise */}
        {todos.length > 0 && (
          <Cell className="p-3">
            <h2 className="sr-only">Needs your attention</h2>
            <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">{todos.map((t) => <Todo key={t.label} {...t} />)}</ul>
          </Cell>
        )}
        {/* Orders as they land: appears once there is a live product to sell */}
        {hasLive && <LiveFeed />}
      </section>

      <section aria-labelledby="products-title" className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 id="products-title" className="font-display text-xl font-bold">Recent products</h2>
          {!!products?.length && <Link href="/catalog/products" className="text-sm font-semibold text-primary underline underline-offset-4">All products</Link>}
        </div>
        {products && products.length > 0 ? (
          <ul className="divide-y rounded-card border bg-surface">
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={`/catalog/products/${p.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted/50">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                  <MoneyText value={p.price} mono />
                  <StatusPill status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : products ? (
          <EmptyState compact icon={Package} title="No products yet." action={<Button asChild><GuardedLink kind="products" href="/catalog/products/new"><Plus aria-hidden /> Add product</GuardedLink></Button>} />
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
          <Button asChild>
            <GuardedLink kind="products" href="/catalog/products/new" data-coach="new-product">
              <Plus aria-hidden /> Add product
            </GuardedLink>
          </Button>
        }
      />

      {plan.data?.plan.status === "trial" && plan.data.plan.trialEndsAt && (
        <div className="mb-6 flex items-center gap-3 rounded-card border border-accent/40 bg-accent-soft px-4 py-3">
          <Sparkles className="size-5 shrink-0 text-accent-ink" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>Free month</strong> until {formatDate(plan.data.plan.trialEndsAt)}
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
