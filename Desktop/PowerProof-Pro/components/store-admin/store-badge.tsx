"use client";

import { Store as StoreIcon } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getOwnedStores } from "@/lib/api";
import { cn } from "@/lib/utils";

/** "Store: <store name>" on every screen whose settings belong to one store (Part 6C). */
export function StoreBadge({ className, storeName }: { className?: string; storeName?: string; /** @deprecated kept for older call sites */ layout?: boolean }) {
  const { data: store } = useCurrentStore();
  const { data: stores } = useApi(getOwnedStores, [], { live: true });
  const name = storeName ?? store?.name;
  if (!name) return null;
  return (
    <p className={cn("mb-3 inline-flex max-w-full items-center gap-1.5 rounded-full border bg-surface px-3 py-1 text-xs", className)}>
      <StoreIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="shrink-0 text-muted-foreground [overflow-wrap:normal]">Store:</span>
      <span className="min-w-0 truncate font-semibold">{name}</span>
      {(stores?.length ?? 0) > 1 && <span className="hidden shrink-0 whitespace-nowrap text-muted-foreground [overflow-wrap:normal] sm:inline">· switch in the top bar</span>}
    </p>
  );
}
