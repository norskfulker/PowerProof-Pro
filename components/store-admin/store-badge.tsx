"use client";

import { usePathname } from "next/navigation";
import { Store as StoreIcon } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { getOwnedStores, getStore } from "@/lib/api";
import { cn } from "@/lib/utils";

/** "Store: Ananya Makes" on every screen whose settings belong to one store (Part 6C). */
export function StoreBadge({ className, storeName, layout }: { className?: string; storeName?: string; /** Rendered by a layout: skip on per-store pages, which show their own */ layout?: boolean }) {
  const pathname = usePathname();
  const { data: store } = useApi(getStore, [], { live: true });
  const { data: stores } = useApi(getOwnedStores, [], { live: true });
  const name = storeName ?? store?.name;
  const perStore = /^\/store\/(?!pages\/)[^/]+\/pages\//.test(pathname ?? "");
  if (!name || (layout && perStore)) return null;
  return (
    <p className={cn("mb-3 inline-flex max-w-full items-center gap-1.5 rounded-full border bg-surface px-3 py-1 text-xs", className)}>
      <StoreIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="shrink-0 text-muted-foreground [overflow-wrap:normal]">Store:</span>
      <span className="min-w-0 truncate font-semibold">{name}</span>
      {(stores?.length ?? 0) > 1 && <span className="hidden shrink-0 whitespace-nowrap text-muted-foreground [overflow-wrap:normal] sm:inline">· switch in the top bar</span>}
    </p>
  );
}
