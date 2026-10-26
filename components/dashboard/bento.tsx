"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, PackagePlus, Store as StoreIcon } from "lucide-react";
import { MoneyText } from "@/components/pp/money-text";
import { GuardedLink } from "@/components/plan/plan-context";
import { Skeleton } from "@/components/ui/skeleton";
import { markLinkShared } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Balance, Store } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A plain dashboard card */
export function Cell({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative overflow-hidden rounded-card border bg-surface p-5", className)} {...rest}>
      {children}
    </div>
  );
}

/** Money ready to take out */
export function BalanceCell({ balance, className }: { balance?: Balance; className?: string }) {
  return (
    <Cell className={cn("flex flex-col gap-1", className)}>
      <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        Balance
        <Link href="/sales/payouts/balance?withdraw=1" className="font-semibold text-primary underline-offset-4 hover:underline">Withdraw</Link>
      </p>
      {balance ? <MoneyText value={balance.available} className="font-display text-3xl font-bold tracking-[-0.03em]" /> : <Skeleton className="h-8 w-28" />}
      <p className="text-sm text-muted-foreground">
        {balance && balance.pending.amount > 0 ? (
          <>+ <MoneyText value={balance.pending} /> pending{balance.nextReleaseAt ? `, from ${formatDate(balance.nextReleaseAt)}` : ""}</>
        ) : (
          "No pending payments"
        )}
      </p>
    </Cell>
  );
}

/** The two things a seller does most: add a product, and see the live store */
export function QuickActions({ store }: { store?: Store }) {
  const big = "group flex min-h-24 items-center gap-4 rounded-card border p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:hover:translate-y-0";
  return (
    <section aria-labelledby="qa-h" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <h2 id="qa-h" className="sr-only">Quick actions</h2>
      <GuardedLink kind="products" href="/catalog/products/new" data-coach="new-product" className={cn(big, "border-primary/30 bg-primary text-primary-foreground hover:border-primary")}>
        <span className="grid size-12 shrink-0 place-items-center rounded-control bg-white/15"><PackagePlus className="size-6" aria-hidden /></span>
        <span className="min-w-0 flex-1 text-lg font-bold">Add product</span>
        <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </GuardedLink>
      <a
        href={store ? `/s/${store.slug}` : undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!store || undefined}
        data-coach="share-link"
        onClick={() => store && markLinkShared()}
        className={cn(big, "border-accent/40 bg-accent-soft text-accent-ink hover:border-accent", !store && "pointer-events-none opacity-60")}
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-control bg-accent text-accent-foreground"><StoreIcon className="size-6" aria-hidden /></span>
        <span className="min-w-0 flex-1 text-lg font-bold">View store</span>
        <ExternalLink className="size-5 shrink-0" aria-hidden />
      </a>
    </section>
  );
}
