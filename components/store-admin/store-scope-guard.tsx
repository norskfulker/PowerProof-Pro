"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ErrorState } from "@/components/pp/empty-state";
import { StoreBadge } from "@/components/store-admin/store-badge";
import { StoreTabs } from "@/components/store-admin/store-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveStoreId, getOwnedStores, switchStore } from "@/lib/api";

/** Store-scoped pages render once the store in the URL is the active one. */
export function StoreScopeGuard({ storeId, children, badge = true }: { storeId: string; children: React.ReactNode; badge?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    (async () => {
      const active = await getActiveStoreId();
      if (storeId === "current") {
        const qs = search.toString();
        router.replace(pathname.replace("/store/current", `/store/${active}`) + (qs ? `?${qs}` : ""));
        return;
      }
      if (active !== storeId) {
        const owned = await getOwnedStores();
        if (!owned.some((s) => s.id === storeId)) {
          if (live) setError("This store isn't one of yours, or it was removed.");
          return;
        }
        await switchStore(storeId);
      }
      if (live) setReady(true);
    })().catch((e) => live && setError(e instanceof Error ? e.message : "That store didn't load."));
    return () => {
      live = false;
    };
  }, [storeId, pathname, search, router]);

  // The store editor fills the screen under the tabs
  const editing = /\/design\/pages\/[^/]+\/edit$/.test(pathname);

  if (error) return <ErrorState message={error} onRetry={() => router.replace(pathname.replace(`/store/${storeId}`, "/store/current"))} />;
  if (!ready) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-6 w-48 rounded-full" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    );
  }
  return (
    <>
      {badge && !editing && <StoreBadge />}
      {/* Store settings and Domain belong to Settings; everything else in the Store area has tabs */}
      {!pathname.endsWith("/settings") && !pathname.endsWith("/domain") && <StoreTabs />}
      {children}
    </>
  );
}
