"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { getPaymentEvents } from "@/lib/api/activity";
import { getNavCounts } from "@/lib/api";
import { formatMoney, money } from "@/lib/money";
import type { CurrencyCode, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Severity = "high" | "medium" | "low";
interface Item {
  id: string;
  severity: Severity;
  title: string;
  /** What happened and why it matters */
  body: string;
  /** The affected records, by name */
  context?: string;
  action: { label: string; href: string };
}

const SEVERITY: Record<Severity, { label: string; icon: typeof Info; chip: string; rail: string }> = {
  high: { label: "Urgent", icon: AlertTriangle, chip: "bg-danger-soft text-danger", rail: "bg-danger" },
  medium: { label: "Soon", icon: CircleAlert, chip: "bg-warning-soft text-warning-ink", rail: "bg-warning" },
  low: { label: "When you can", icon: Info, chip: "bg-primary-soft text-primary", rail: "bg-primary/50" },
};

/** Units left for a physical product that counts stock (all variants together); undefined otherwise */
export const stockOf = (p: Product) => (p.fulfilment !== "physical" || !p.trackStock ? undefined : p.variants?.length ? p.variants.reduce((t, v) => t + (v.stock ?? 0), 0) : (p.stock ?? 0));

const names = (list: string[], max = 3) => (list.length > max ? `${list.slice(0, max).join(", ")} and ${list.length - max} more` : list.join(", "));
const SINCE = 60 * 86_400_000;

/**
 * What needs the seller now, each with what happened, why it matters, which records, and a button
 * that goes straight to fixing it. Built only from the store's data; nothing shows when all is well.
 */
export function NeedsAttention({ products, storeId }: { products: Product[] | undefined; storeId: string }) {
  const counts = useApi(() => getNavCounts("creator"), [], { live: true });
  const late = useApi(() => getPaymentEvents({ kinds: ["late_payment", "refund_requested", "refund_processing", "refunded"], since: new Date(Date.now() - SINCE).toISOString(), limit: 200 }), [], { live: true });
  const c = counts.data?.counts ?? {};
  const items: Item[] = [];

  // Paid after the order was cancelled, and not refunded yet
  const refunded = new Set((late.data ?? []).filter((e) => e.kind !== "late_payment").map((e) => e.orderId));
  for (const e of (late.data ?? []).filter((x) => x.kind === "late_payment" && !refunded.has(x.orderId))) {
    items.push({
      id: `late-${e.id}`,
      severity: "high",
      title: `Refund the payment for cancelled order ${e.orderRef ?? ""}`.trim(),
      body: "The buyer paid after the order was cancelled for not being paid within an hour. They have been charged and have nothing to show for it.",
      context: [e.buyerName, e.amountMinor != null && e.currency ? formatMoney(money(e.amountMinor, e.currency as CurrencyCode)) : null, e.paymentId].filter(Boolean).join(" · "),
      action: { label: "Review order", href: `/sales/orders/${e.orderId}` },
    });
  }

  if (c.orders_disputed)
    items.push({
      id: "disputes",
      severity: "high",
      title: `Answer ${c.orders_disputed} payment ${c.orders_disputed === 1 ? "dispute" : "disputes"}`,
      body: "A buyer asked their bank to reverse a payment. A dispute that isn't answered in time is lost, and the money is taken back.",
      action: { label: "Review disputes", href: "/sales/orders?status=disputed" },
    });

  const live = (products ?? []).filter((p) => p.status === "published");
  const out = live.filter((p) => stockOf(p) === 0);
  const low = live.filter((p) => (stockOf(p) ?? 99) > 0 && (stockOf(p) ?? 99) <= 5);
  if (out.length)
    items.push({
      id: "out",
      severity: "high",
      title: `${out.length} live ${out.length === 1 ? "product is" : "products are"} out of stock`,
      body: "Buyers see these as sold out and can't order them, so you're missing sales.",
      context: names(out.map((p) => p.title)),
      action: { label: "Update stock", href: out.length === 1 ? `/catalog/products/${out[0].id}` : "/catalog/products" },
    });
  if (low.length)
    items.push({
      id: "low",
      severity: "medium",
      title: `${low.length} ${low.length === 1 ? "product is" : "products are"} running low`,
      body: "Five or fewer left. Restock before they sell out.",
      context: low.map((p) => `${p.title} (${stockOf(p)} left)`).slice(0, 3).join(", "),
      action: { label: "Update product", href: low.length === 1 ? `/catalog/products/${low[0].id}` : "/catalog/products" },
    });

  if (c.reviews_pending)
    items.push({
      id: "reviews",
      severity: "medium",
      title: `${c.reviews_pending} ${c.reviews_pending === 1 ? "review is" : "reviews are"} waiting for you`,
      body: "New reviews stay hidden from your store until you approve them. Replying shows buyers you're listening.",
      action: { label: "Review now", href: `/store/${storeId}/design/pages/home/edit?panel=reviews` },
    });
  if (c.questions_open)
    items.push({
      id: "questions",
      severity: "medium",
      title: `${c.questions_open} buyer ${c.questions_open === 1 ? "question needs" : "questions need"} an answer`,
      body: "Shoppers asked before buying. An unanswered question is often a lost sale.",
      action: { label: "Answer", href: `/store/${storeId}/design/pages/home/edit?panel=questions` },
    });

  const drafts = (products ?? []).filter((p) => p.status === "draft");
  if (drafts.length)
    items.push({
      id: "drafts",
      severity: "low",
      title: `${drafts.length} draft ${drafts.length === 1 ? "product isn't" : "products aren't"} for sale yet`,
      body: "Drafts aren't visible to buyers. Finish and publish them to start selling.",
      context: names(drafts.map((p) => p.title)),
      action: { label: "Finish and publish", href: drafts.length === 1 ? `/catalog/products/${drafts[0].id}` : "/catalog/products?status=draft" },
    });

  if (!items.length) return null;
  const order: Severity[] = ["high", "medium", "low"];
  items.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  return (
    <section aria-labelledby="todo-title" className="flex flex-col gap-3">
      <h2 id="todo-title" className="flex items-center gap-2 text-base">
        Needs your attention <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs">{items.length}</span>
      </h2>
      <ul className="flex flex-col divide-y overflow-hidden rounded-card border bg-surface">
        {items.map((it) => {
          const sev = SEVERITY[it.severity];
          return (
            <li key={it.id} className="relative flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-center">
              <span className={cn("absolute top-0 bottom-0 left-0 w-1", sev.rail)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", sev.chip)}>
                    <sev.icon className="size-3" aria-hidden /> {sev.label}
                  </span>
                  <span className="font-semibold">{it.title}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{it.body}</p>
                {it.context && <p className="mt-1 truncate text-xs text-foreground/80">{it.context}</p>}
              </div>
              <Button asChild size="sm" variant={it.severity === "high" ? "primary" : "secondary"} className="shrink-0 self-start sm:self-center">
                <Link href={it.action.href}>
                  {it.action.label} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
