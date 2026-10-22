"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EyeOff, MoreHorizontal, Package, Pencil, Plus, Rocket, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { DealCard } from "@/components/marketplace/deal-card";
import { DealForm, startingDeal, toInput, valuesFromDeal } from "@/components/marketplace/deal-form";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiState } from "@/hooks/use-api";
import { createDeal, deleteDeal, updateDeal, type Deal, type MyDeal } from "@/lib/api";
import { discountPercent } from "@/lib/money";
import type { Product, Store } from "@/lib/types";

/** The creator's own deal, in the same shape buyers see it, so both lists render the one card. */
export function asBuyerDeal(d: MyDeal, product: Product | undefined, store: Store | undefined): Deal {
  return {
    id: d.id,
    title: d.title,
    pitch: d.pitch,
    billing: d.billing,
    interval: d.interval,
    original: d.original,
    price: d.price,
    percentOff: discountPercent(d.price, d.original),
    productSlug: product?.slug ?? "",
    storeName: store?.name ?? "",
    storeSlug: store?.slug ?? "",
    country: store?.country ?? "IN",
    fulfilment: product?.fulfilment ?? "digital",
    kind: product?.kind ?? "other",
    cover: product?.images[0]?.src,
    coverBg: product?.tileBackground?.kind === "color" ? product.tileBackground.color : undefined,
    verified: d.verified,
    trusted: false,
    sold: product?.salesCount ?? 0,
    revenue: d.showRevenue ? product?.revenue : undefined,
    revenue30: undefined,
    rating: undefined,
    reviews: 0,
    endsAt: d.endsAt,
    createdAt: d.createdAt,
  };
}

/** The deals this store has listed, shown exactly as buyers see them, with pause, edit and delete. */
export function MyDeals({ deals, products, store, onNew, onEdit }: { deals: ApiState<MyDeal[]>; products: Product[] | undefined; store: Store | undefined; onNew: () => void; onEdit: (id: string) => void }) {
  const [toDelete, setToDelete] = useState<MyDeal>();

  // Pausing keeps the deal and its prices; it just leaves the marketplace
  const setLive = async (d: MyDeal, live: boolean) => {
    await updateDeal(d.id, { ...toInput(valuesFromDeal(d)), status: live ? "live" : "paused" });
    toast.success(live ? "Showing in the marketplace again" : "Paused", { description: d.title });
    deals.reload();
  };

  if (deals.error) return <ErrorState message={deals.error} onRetry={deals.reload} />;
  if (deals.loading && !deals.data) {
    return (
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
        {Array.from({ length: 3 }).map((_, i) => <li key={i}><Skeleton className="h-[26rem] rounded-card" /></li>)}
      </ul>
    );
  }
  if (!deals.data?.length) {
    return <EmptyState icon={Tag} title="No deals yet." body="Pick a live product, set the original price and your price, and it shows in the marketplace straight away." action={<Button onClick={onNew}><Plus aria-hidden /> List a deal</Button>} />;
  }
  return (
    <>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {deals.data.map((d) => {
          const p = products?.find((x) => x.id === d.productId);
          const hidden = !!p && p.status !== "published";
          return (
            <li key={d.id} className="flex flex-col gap-3">
              <div className="flex-1">
                <DealCard d={asBuyerDeal(d, p, store)} href={`/marketplace?tab=mine&deal=${d.id}`} hideSeller />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={d.status === "live" ? "published" : "draft"} label={d.status === "live" ? "Showing" : "Paused"} tone={d.status === "live" ? "success" : "neutral"} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Actions for ${d.title}`}><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(d.id)}><Pencil aria-hidden /> Edit</DropdownMenuItem>
                    {d.status === "live" ? (
                      <DropdownMenuItem onSelect={() => setLive(d, false)}><EyeOff aria-hidden /> Pause</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => setLive(d, true)}><Rocket aria-hidden /> Make it live</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(d)}><Trash2 aria-hidden /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {hidden && <p className="text-sm font-medium text-warning-ink">The product is {p?.status === "draft" ? "a draft" : "archived"}, so this deal is hidden until it is live.</p>}
            </li>
          );
        })}
      </ul>
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

/**
 * Listing a new deal, or editing one, right on the Marketplace page. A new deal needs a live
 * product that doesn't have one yet; an edit saves itself.
 */
export function DealEditor({ dealId, deals, products, store, onDone }: { dealId?: string; deals: ApiState<MyDeal[]>; products: ApiState<Product[]>; store: ApiState<Store>; onDone: () => void }) {
  if (deals.error || products.error || store.error) return <ErrorState message={deals.error ?? products.error ?? store.error} onRetry={() => { deals.reload(); products.reload(); store.reload(); }} />;
  if (!deals.data || !products.data || !store.data) return <Skeleton className="h-96 rounded-card" />;

  if (dealId) {
    const deal = deals.data.find((d) => d.id === dealId);
    if (!deal) return <EmptyState icon={Tag} title="That deal isn't here any more." body="It may have been deleted." action={<Button variant="secondary" onClick={onDone}>Back to my deals</Button>} />;
    return (
      <DealForm
        mode="edit"
        initial={valuesFromDeal(deal)}
        products={products.data.filter((p) => p.id === deal.productId)}
        currency={store.data.currency}
        storeName={store.data.name}
        onSubmit={async (v) => {
          await updateDeal(dealId, toInput(v));
          deals.reload();
        }}
      />
    );
  }

  const taken = new Set(deals.data.map((d) => d.productId));
  const free = products.data.filter((p) => p.status === "published" && !taken.has(p.id));
  if (free.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No live product to list."
        body={products.data.some((p) => p.status === "published") ? "All your live products already have a deal." : "Publish a product first. Deals are made from live products."}
        action={<Button asChild><Link href="/catalog/products">Go to your products</Link></Button>}
      />
    );
  }
  return (
    <DealForm
      mode="create"
      initial={startingDeal(free[0], store.data.currency)}
      products={free}
      currency={store.data.currency}
      storeName={store.data.name}
      onSubmit={async (v) => {
        await createDeal(toInput(v));
        toast.success("Your deal is in the marketplace", { description: v.title });
        deals.reload();
        onDone();
      }}
    />
  );
}
