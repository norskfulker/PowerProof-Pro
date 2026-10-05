"use client";

import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { DealPathEditor } from "@/components/store-admin/deal-path-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getDealRules, getOffers, getProducts } from "@/lib/api";

export default function NewDealPathPage() {
  const { data, error, reload } = useApi(() => Promise.all([getProducts(), getDealRules(), getOffers()]), []);
  return (
    <>
      <title>New deal path · PowerProof</title>
      <PageHeader title="New deal path" back={{ href: "/store/offers/deal-paths", label: "Deal paths" }} description="Reward buyers for adding to their order. You'll see exactly what they see as you build it." />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]" aria-busy>
          <Skeleton className="h-[28rem] rounded-card" />
          <Skeleton className="h-80 rounded-card" />
        </div>
      ) : (
        <DealPathEditor products={data[0]} rules={data[1]} storeDeals={data[2].deals} />
      )}
    </>
  );
}
