"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { EyeOff, ExternalLink, MoreHorizontal, Plus, Rocket, Tag, Trash2 } from "lucide-react";
import { DealCard } from "@/components/marketplace/deal-card";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { deleteDeal, getMyDeals, getProducts, updateDeal, type Deal, type MyDeal } from "@/lib/api";
import { discountPercent } from "@/lib/money";
import type { Product, Store } from "@/lib/types";

/** The creator's own deal, in the same shape buyers see it, so both lists render the one card. */
function asBuyerDeal(d: MyDeal, product: Product | undefined, store: Store | undefined): Deal {
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

/** The deals this store has listed in the marketplace, shown exactly as buyers see them. */
export default function MyDealsPage() {
  const deals = useApi(getMyDeals, [], { live: true });
  const products = useApi(() => getProducts(), [], { live: true });
  const store = useCurrentStore();
  const [toDelete, setToDelete] = useState<MyDeal>();

  // Pausing keeps the deal and its prices; it just leaves the marketplace
  const setLive = async (d: MyDeal, live: boolean) => {
    await updateDeal(d.id, {
      productId: d.productId,
      title: d.title,
      pitch: d.pitch,
      billing: d.billing,
      interval: d.interval,
      original: d.original,
      price: d.price,
      endsAt: d.endsAt,
      showRevenue: d.showRevenue,
      status: live ? "live" : "paused",
    });
    toast.success(live ? "Showing in the marketplace again" : "Saved to draft", { description: d.title });
    deals.reload();
  };

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
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => <li key={i}><Skeleton className="h-[26rem] rounded-card" /></li>)}
        </ul>
      ) : deals.data?.length === 0 ? (
        <EmptyState icon={Tag} title="No deals yet." body="Pick a live product, set the original price and your price, and it shows in the marketplace straight away." action={<Button asChild><Link href="/catalog/deals/new"><Plus aria-hidden /> List a deal</Link></Button>} />
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {deals.data?.map((d) => {
            const p = products.data?.find((x) => x.id === d.productId);
            const hidden = !!p && p.status !== "published";
            return (
              <li key={d.id} className="flex flex-col gap-3">
                <div className="flex-1">
                  <DealCard d={asBuyerDeal(d, p, store.data)} href={`/catalog/deals/${d.id}`} hideSeller />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={d.status === "live" ? "published" : "draft"} label={d.status === "live" ? "Showing" : "Paused"} tone={d.status === "live" ? "success" : "neutral"} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Actions for ${d.title}`}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {d.status === "live" ? (
                        <DropdownMenuItem onSelect={() => setLive(d, false)}><EyeOff aria-hidden /> Save to draft</DropdownMenuItem>
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
