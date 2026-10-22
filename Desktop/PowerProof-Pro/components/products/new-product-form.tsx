"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePlan } from "@/components/plan/plan-context";
import { SetupJourney } from "@/components/onboarding/setup-journey";
import { PageHeader } from "@/components/pp/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStore } from "@/hooks/use-current-store";
import { sellsKind, soldKinds, type SellKind } from "@/lib/shipping";
import { createProduct, setProductCollections } from "@/lib/api";
import { ProductForm } from "./product-form";
import { blankProduct, toInput } from "./to-values";

/**
 * A new digital or physical product (`type`, one the store has switched on; by default the first
 * that is). With `wizard` (someone's first product) it is three short steps; otherwise the full form.
 */
export function NewProductForm({ wizard = false, type: wanted }: { wizard?: boolean; type?: SellKind }) {
  const router = useRouter();
  const plan = usePlan();
  const store = useCurrentStore();
  // Prices are set in the store's currency: wait for it so the form starts in the right one
  if (!store.data) return <Skeleton className="h-96 rounded-card" />;
  // Only a kind the store sells (switched on under Add a product or in Store settings)
  const type = wanted && sellsKind(store.data.sells, wanted) ? wanted : soldKinds(store.data.sells)[0];
  return (
    <>
      {wizard ? (
        <>
          <SetupJourney current={1} />
          <PageHeader title="Add your first product" />
        </>
      ) : (
        <PageHeader
          back={{ href: "/catalog/products/new", label: "Add a product" }}
          title={type === "physical" ? "New physical product" : "New digital product"}
        />
      )}
      <ProductForm
        wizard={wizard}
        initial={blankProduct(type, store.data.currency)}
        submitLabel="Save as draft"
        onSubmit={async (v) => {
          try {
            const p = await createProduct(toInput(v));
            if (v.collectionIds?.length) await setProductCollections(p.id, v.collectionIds);
            toast.success(p.status === "published" ? "Product is live" : "Saved as a draft", { description: p.title });
            router.push(wizard ? "/dashboard" : "/catalog/products");
          } catch (e) {
            if (!plan.handleLimitError(e)) toast.error("Couldn't create it", { description: e instanceof Error ? e.message : undefined });
            throw e;
          }
        }}
      />
    </>
  );
}
