"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DealForm, startingDeal, toInput } from "@/components/marketplace/deal-form";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { createDeal, getMyDeals, getProducts } from "@/lib/api";
import Link from "next/link";
import { Package } from "lucide-react";

/** List a product as a deal. Needs a live product that doesn't have one yet. */
export default function NewDealPage() {
  const router = useRouter();
  const store = useCurrentStore();
  const products = useApi(() => getProducts(), []);
  const deals = useApi(getMyDeals, []);
  const header = <PageHeader back={{ href: "/catalog/deals", label: "Marketplace deals" }} title="List a deal" description="Pick a live product, say how it's paid for, and set the original price and yours." />;

  if (products.error || deals.error || store.error) return <>{header}<ErrorState message={products.error ?? deals.error ?? store.error} onRetry={() => { products.reload(); deals.reload(); store.reload(); }} /></>;
  if (!products.data || !deals.data || !store.data) return <>{header}<Skeleton className="h-96 rounded-card" /></>;

  const taken = new Set(deals.data.map((d) => d.productId));
  const free = products.data.filter((p) => p.status === "published" && !taken.has(p.id));
  if (free.length === 0) {
    return (
      <>
        {header}
        <EmptyState icon={Package} title="No live product to list." body={products.data.some((p) => p.status === "published") ? "All your live products already have a deal." : "Publish a product first. Deals are made from live products."} action={<Button asChild><Link href="/catalog/products">Go to products</Link></Button>} />
      </>
    );
  }
  return (
    <>
      {header}
      <DealForm
        mode="create"
        initial={startingDeal(free[0], store.data.currency)}
        products={free}
        currency={store.data.currency}
        storeName={store.data.name}
        onSubmit={async (v) => {
          await createDeal(toInput(v));
          toast.success("Your deal is in the marketplace", { description: v.title });
          router.push("/catalog/deals");
        }}
      />
    </>
  );
}
