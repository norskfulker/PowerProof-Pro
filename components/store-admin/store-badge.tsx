"use client";

import { ExternalLink, Store as StoreIcon } from "lucide-react";
import { StoreKind, StorePlace } from "@/components/pp/store-kind";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getOwnedStores } from "@/lib/api";
import { storeUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "Store: <name>" on every screen whose settings belong to one store (Part 6C), with what kind of
 * store it is (digital or physical), where it's based and the address its live products are at.
 */
export function StoreBadge({ className, storeName }: { className?: string; storeName?: string; /** @deprecated kept for older call sites */ layout?: boolean }) {
  const { data: store } = useCurrentStore();
  const { data: stores } = useApi(getOwnedStores, [], { live: true });
  const name = storeName ?? store?.name;
  if (!name) return null;
  const here = stores?.find((s) => s.id === store?.id);
  return (
    <p className={cn("mb-3 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-card border bg-surface px-3 py-1.5 text-xs", className)}>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <StoreIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="shrink-0 text-muted-foreground [overflow-wrap:normal]">Store:</span>
        <span className="min-w-0 truncate font-semibold">{name}</span>
      </span>
      {store && <StoreKind sells={store.sells} />}
      {store && <StorePlace country={store.country} />}
      {store && (
        <a href={`/s/${store.slug}`} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-mono text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          <span className="truncate">{storeUrl(store.slug)}</span>
          <ExternalLink className="size-3 shrink-0" aria-hidden />
        </a>
      )}
      {here && <span className="shrink-0 whitespace-nowrap text-muted-foreground">· {here.liveProducts} live {here.liveProducts === 1 ? "product" : "products"}</span>}
      {(stores?.length ?? 0) > 1 && <span className="hidden shrink-0 whitespace-nowrap text-muted-foreground [overflow-wrap:normal] sm:inline">· switch in the top bar</span>}
    </p>
  );
}
