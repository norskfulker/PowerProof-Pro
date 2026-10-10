"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Clock, ExternalLink, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { perLabel } from "@/components/marketplace/deal-card";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { deleteDeal, getMyDeals, getProducts, type MyDeal } from "@/lib/api";
import { discountPercent } from "@/lib/money";
import { formatDate } from "@/lib/format";

/** The deals this store has listed in the marketplace. */
export default function MyDealsPage() {
  const deals = useApi(getMyDeals, [], { live: true });
  const products = useApi(() => getProducts(), [], { live: true });
  const [toDelete, setToDelete] = useState<MyDeal>();
  const title = (id: string) => products.data?.find((p) => p.id === id);

  return (
    <>
      <PageHeader
        title="Marketplace deals"
        description="List a product as a deal for buyers to find: a one-time payment or a subscription, with your price next to the original."
        actions={
          <>
            <Button asChild variant="secondary"><Link href="/marketplace"><ExternalLink aria-hidden /> See the marketplace</Link></Button>
            <Button asChild><Link href="/catalog/deals/new"><Plus aria-hidden /> List a deal</Link></Button>
          </>
        }
      />
      {deals.error ? (
        <ErrorState message={deals.error} onRetry={deals.reload} />
      ) : deals.loading && !deals.data ? (
        <Skeleton className="h-48 rounded-card" />
      ) : deals.data?.length === 0 ? (
        <EmptyState icon={Tag} title="No deals yet." body="Pick a live product, set the original price and your price, and it shows in the marketplace straight away." action={<Button asChild><Link href="/catalog/deals/new"><Plus aria-hidden /> List a deal</Link></Button>} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {deals.data?.map((d) => {
            const p = title(d.productId);
            const off = discountPercent(d.price, d.original);
            return (
              <li key={d.id} className="flex flex-col gap-3 rounded-card border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-extrabold [overflow-wrap:anywhere]">{d.title}</h2>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">On {p ? p.title : "Product"} · {d.billing === "subscription" ? `Subscription${perLabel(d)}` : "One-time"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill status={d.status === "live" ? "published" : "draft"} label={d.status === "live" ? "Showing" : "Paused"} tone={d.status === "live" ? "success" : "neutral"} />
                    {d.verified && <span className="text-xs font-semibold text-primary">Verified</span>}
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{d.pitch}</p>
                <p className="flex flex-wrap items-baseline gap-2">
                  <MoneyText value={d.price} className="font-display text-2xl" />
                  <MoneyText value={d.original} className="text-sm text-muted-foreground line-through" />
                  {off > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-accent-foreground">{off}% off</span>}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" aria-hidden /> {d.endsAt ? `Ends ${formatDate(d.endsAt)}` : "No end date · runs until you pause it"}</p>
                {p && p.status !== "published" && <p className="text-sm font-medium text-warning-ink">The product is {p.status === "draft" ? "a draft" : "archived"}, so this deal is hidden until it is live.</p>}
                <div className="mt-auto flex gap-2">
                  <Button asChild variant="secondary" size="sm"><Link href={`/catalog/deals/${d.id}`}><Pencil aria-hidden /> Edit</Link></Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setToDelete(d)}><Trash2 aria-hidden /> Delete</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(undefined)}
        title={`Delete ${toDelete?.title ?? "this deal"}?`}
        description="It leaves the marketplace. The product stays in your catalogue at its current price."
        confirmLabel="Delete deal"
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteDeal(toDelete.id);
          toast.success("Deal deleted");
          deals.reload();
        }}
      />
    </>
  );
}
