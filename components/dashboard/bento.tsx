"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Brush, Check, Copy, Plus, Receipt, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { MoneyText } from "@/components/pp/money-text";
import { copyText } from "@/components/pp/copy-field";
import { GuardedLink } from "@/components/plan/plan-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { markLinkShared } from "@/lib/api";
import { formatDate, formatNumber, SITE_URL } from "@/lib/format";
import type { Balance, Store, Summary } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A plain dashboard card */
export function Cell({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative overflow-hidden rounded-card border bg-surface p-5", className)} {...rest}>
      {children}
    </div>
  );
}

function Delta({ v }: { v: number | null | undefined }) {
  if (v == null) return null;
  const up = v >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
      <span className="sr-only">{up ? "Up" : "Down"}</span>
      {Math.abs(v).toFixed(0)}%
    </span>
  );
}

/** Today's revenue, with sales and visitors underneath */
export function TodayCell({ summary, loading, className }: { summary?: Summary; loading: boolean; className?: string }) {
  const s = summary;
  return (
    <Cell className={cn("flex flex-col gap-1", className)}>
      <p className="text-sm text-muted-foreground">Today</p>
      {loading || !s ? (
        <Skeleton className="h-8 w-32" />
      ) : (
        <p className="flex items-baseline gap-2">
          <MoneyText value={s.revenue} className="font-display text-3xl font-bold tracking-[-0.03em]" />
          <Delta v={s.deltas.revenue} />
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {s ? `${formatNumber(s.sales)} ${s.sales === 1 ? "sale" : "sales"} · ${s.visitors == null ? "—" : formatNumber(s.visitors)} visitors` : " "}
      </p>
    </Cell>
  );
}

/** Money ready to take out */
export function BalanceCell({ balance, className }: { balance?: Balance; className?: string }) {
  return (
    <Cell className={cn("flex flex-col gap-1", className)}>
      <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        Ready to withdraw
        <Link href="/sales/payouts/balance?withdraw=1" className="font-semibold text-primary underline-offset-4 hover:underline">Withdraw</Link>
      </p>
      {balance ? <MoneyText value={balance.available} className="font-display text-3xl font-bold tracking-[-0.03em]" /> : <Skeleton className="h-8 w-28" />}
      <p className="text-sm text-muted-foreground">
        {balance && balance.pending.amount > 0 ? (
          <>+ <MoneyText value={balance.pending} /> pending{balance.nextReleaseAt ? `, from ${formatDate(balance.nextReleaseAt)}` : ""}</>
        ) : (
          "Nothing pending"
        )}
      </p>
    </Cell>
  );
}

const ACTIONS: { href: string; label: string; icon: typeof Plus; guard?: true; coach?: string }[] = [
  { href: "/catalog/products/new", label: "Add product", icon: Plus, guard: true, coach: "new-product" },
  { href: "/sales/orders", label: "Orders", icon: Receipt },
  { href: "/store/{store}/design/pages/home/edit", label: "Edit store", icon: Brush },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
];

/** The everyday shortcuts, one slim row: labels only */
export function ActionCells({ store }: { store?: Store }) {
  const [copied, setCopied] = useState(false);
  const url = store ? `${SITE_URL}/${store.slug}` : "";
  return (
    <ul aria-label="Quick actions" className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => {
        const href = a.href.replace("{store}", store?.id ?? "current");
        const body = <><a.icon aria-hidden /> {a.label}</>;
        return (
          <li key={a.label}>
            <Button asChild variant="secondary" size="sm">
              {a.guard ? <GuardedLink kind="products" href={href} data-coach={a.coach}>{body}</GuardedLink> : <Link href={href}>{body}</Link>}
            </Button>
          </li>
        );
      })}
      <li>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-full"
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
  );
}
