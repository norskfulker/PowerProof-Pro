"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, FileDown, Link2, Loader2, Package, Phone, ScanSearch, Timer, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { editPageHref } from "@/components/store-admin/add-page-dialog";
import { MoneyText } from "@/components/pp/money-text";
import { usePlan } from "@/components/plan/plan-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createVisualPage } from "@/lib/api";
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

/** Money ready to take out, with Withdraw: the Balance tab of the metrics card */
export function BalancePanel({ balance }: { balance?: Balance }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Available to withdraw</p>
        {balance ? <MoneyText value={balance.available} className="font-display text-3xl font-bold tracking-[-0.03em]" /> : <Skeleton className="h-9 w-40" />}
        <p className="text-sm text-muted-foreground">
          {balance && balance.pending.amount > 0 ? (
            <>+ <MoneyText value={balance.pending} /> pending{balance.nextReleaseAt ? `, from ${formatDate(balance.nextReleaseAt)}` : ""}</>
          ) : (
            "No pending payments"
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href="/sales/payouts/balance">Payout history</Link>
        </Button>
        {balance && balance.available.amount > 0 ? (
          <Button asChild>
            <Link href="/sales/payouts/balance?withdraw=1">Withdraw</Link>
          </Button>
        ) : (
          <Button type="button" disabled>Withdraw</Button>
        )}
      </div>
    </div>
  );
}

type Creation = { id: string; label: string; hint: string; icon: LucideIcon; tone: string; free?: true } & ({ page: string } | { href: string });

/** What a seller most often starts: pages from the ready-made templates, products, link import and agents */
const CREATIONS: Creation[] = [
  { id: "bio", label: "Link in bio", hint: "Your best links on one page", icon: Link2, tone: "bg-primary-soft text-primary", page: "bio" },
  { id: "digital", label: "Sell digital products", hint: "Files buyers download", icon: FileDown, tone: "bg-info-soft text-info", href: "/catalog/products/new/upload?type=digital" },
  { id: "physical", label: "Sell physical products", hint: "Things you ship", icon: Package, tone: "bg-warning-soft text-warning-ink", href: "/catalog/products/new/upload?type=physical" },
  { id: "scrape", label: "Scrape products", hint: "Paste a shop's link", icon: ScanSearch, tone: "bg-accent-soft text-accent-ink", href: "/catalog/products?link=1" },
  { id: "countdown", label: "Countdown page", hint: "A sale with a timer", icon: Timer, tone: "bg-danger-soft text-danger", page: "sale" },
  { id: "call", label: "Book a call", hint: "Visitors pick a time", icon: Phone, tone: "bg-success-soft text-success", page: "booking" },
  { id: "agents", label: "Scheduled agents", hint: "Run on a timetable", icon: Bot, tone: "bg-muted text-foreground", href: "/marketplace?sort=credits", free: true },
];

const PAGE_TITLES: Record<string, string> = { bio: "Link in bio", sale: "Countdown", booking: "Book a call" };

/**
 * Quick creations: one click starts each. Pages are made from their template and open in the
 * editor; products open the form for their kind (a store sells one kind at a time, so the other
 * kind leads to Store settings, where shipping is switched).
 */
export function QuickCreate({ store }: { store?: Store }) {
  const router = useRouter();
  const { guard, handleLimitError } = usePlan();
  const [busy, setBusy] = useState<string>();
  const tile = "group flex min-h-28 flex-col gap-3 rounded-card border bg-surface p-4 text-left transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 motion-reduce:hover:translate-y-0";

  const makePage = (template: string) =>
    guard("pages", async () => {
      setBusy(template);
      try {
        const p = await createVisualPage({ templateId: template, title: PAGE_TITLES[template] ?? "New page" });
        router.push(editPageHref(p.id));
      } catch (e) {
        if (!handleLimitError(e)) toast.error(e instanceof Error ? e.message : "Couldn't create the page.");
        setBusy(undefined);
      }
    });

  const body = (c: Creation, note?: string) => (
    <>
      <span className={cn("grid size-10 place-items-center rounded-control", c.tone)}>
        {busy === ("page" in c ? c.page : "") ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <c.icon className="size-5" aria-hidden />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {c.label}
          {c.free && <span className="rounded-full bg-success-soft px-1.5 py-px text-[0.6875rem] font-semibold text-success">Free</span>}
        </span>
        <span className="text-xs text-muted-foreground">{note ?? c.hint}</span>
      </span>
    </>
  );

  return (
    <section aria-labelledby="qc-h" className="flex flex-col gap-3">
      <h2 id="qc-h" className="font-display text-lg">Quick create</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {CREATIONS.map((c) => {
          if ("page" in c)
            return (
              <li key={c.id}>
                <button type="button" className={cn(tile, "w-full")} disabled={!store || !!busy} onClick={() => makePage(c.page)}>
                  {body(c)}
                </button>
              </li>
            );
          // The kind the store doesn't sell yet is switched on in Store settings first
          const kind = c.id === "digital" ? "digital" : c.id === "physical" ? "physical" : undefined;
          const other = kind && store && store.sells !== kind;
          return (
            <li key={c.id}>
              <Link href={other ? `/store/${store.id}/settings` : c.href} data-coach={kind && !other ? "new-product" : undefined} className={cn(tile, "h-full")}>
                {body(c, other ? (kind === "physical" ? "Turn on shipping first" : "Turn off shipping first") : undefined)}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
