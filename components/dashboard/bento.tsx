"use client";

import Link from "next/link";
import { ArrowRight, Bot, Brush, Check, Copy, PackagePlus } from "lucide-react";
import { useState } from "react";
import { MoneyText } from "@/components/pp/money-text";
import { copyText } from "@/components/pp/copy-field";
import { GuardedLink } from "@/components/plan/plan-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { markLinkShared } from "@/lib/api";
import { formatDate, SITE_URL } from "@/lib/format";
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

/**
 * The two things a seller starts most: a product and an agent, each in its own colour, with the
 * everyday shortcuts underneath (edit the store, copy its link).
 */
export function QuickActions({ store }: { store?: Store }) {
  const [copied, setCopied] = useState(false);
  const url = store ? `${SITE_URL}/${store.slug}` : "";
  const big = "group flex min-h-24 items-center gap-4 rounded-card border p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:hover:translate-y-0";
  return (
    <section aria-labelledby="qa-h" className="flex flex-col gap-3">
      <h2 id="qa-h" className="sr-only">Quick actions</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GuardedLink kind="products" href="/catalog/products/new" data-coach="new-product" className={cn(big, "border-primary/30 bg-primary text-primary-foreground hover:border-primary")}>
          <span className="grid size-12 shrink-0 place-items-center rounded-control bg-white/15"><PackagePlus className="size-6" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">Add product</span>
            <span className="block text-sm text-primary-foreground/80">Physical or digital, live in minutes</span>
          </span>
          <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </GuardedLink>
        <Link href="/marketplace" className={cn(big, "border-accent/40 bg-accent-soft text-accent-ink hover:border-accent")}>
          <span className="grid size-12 shrink-0 place-items-center rounded-control bg-accent text-accent-foreground"><Bot className="size-6" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">Add agent</span>
            <span className="block text-sm opacity-80">Automate follow-ups and reminders</span>
          </span>
          <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
      <ul aria-label="Shortcuts" className="flex flex-wrap gap-2">
        <li>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/store/${store?.id ?? "current"}/design/pages/home/edit`}><Brush aria-hidden /> Edit store</Link>
          </Button>
        </li>
        <li>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!store}
            data-coach="share-link"
            onClick={async () => {
              if (store && (await copyText(`https://${url}`, "Store link copied"))) {
                markLinkShared();
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy store link"}
          </Button>
        </li>
      </ul>
    </section>
  );
}
