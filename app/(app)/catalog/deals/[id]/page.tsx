"use client";

import { use } from "react";
import { DealForm, toInput, valuesFromDeal } from "@/components/marketplace/deal-form";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getMyDeal, getProducts, updateDeal } from "@/lib/api";

export default function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const deal = useApi(() => getMyDeal(id), [id]);
  const products = useApi(() => getProducts(), []);
  const store = useCurrentStore();
  const header = <PageHeader back={{ href: "/catalog/deals", label: "Marketplace deals" }} title="Edit deal" description="Changes save by themselves." />;

  if (deal.error || products.error || store.error) return <>{header}<ErrorState message={deal.error ?? products.error ?? store.error} onRetry={() => { deal.reload(); products.reload(); store.reload(); }} /></>;
  if (!deal.data || !products.data || !store.data) return <>{header}<Skeleton className="h-96 rounded-card" /></>;
  return (
    <>
      {header}
      <DealForm
        mode="edit"
        initial={valuesFromDeal(deal.data)}
        products={products.data.filter((p) => p.id === deal.data!.productId)}
        currency={store.data.currency}
        storeName={store.data.name}
        onSubmit={async (v) => {
          await updateDeal(id, toInput(v));
        }}
      />
    </>
  );
}
