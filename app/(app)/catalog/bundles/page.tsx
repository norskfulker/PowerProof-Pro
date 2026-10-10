"use client";

import { OffersManager } from "@/components/store-admin/offers-manager";
import { useApi } from "@/hooks/use-api";
import { getActiveStoreId } from "@/lib/api";

/** Catalog › Bundles: the bundles of the store chosen in the switcher. */
export default function BundlesPage() {
  const store = useApi(getActiveStoreId, []);
  if (!store.data) return null;
  return <OffersManager storeId={store.data} section="bundles" tabs={false} />;
}
