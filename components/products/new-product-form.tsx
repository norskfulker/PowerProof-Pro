"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePlan } from "@/components/plan/plan-context";
import { SetupJourney } from "@/components/onboarding/setup-journey";
import { PageHeader } from "@/components/pp/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStore } from "@/hooks/use-current-store";
import { createProduct, setProductCollections } from "@/lib/api";
import { ProductForm } from "./product-form";
import { blankProduct, toInput } from "./to-values";

/**
 * A new product of the kind the store sells (digital, or physical once physical shipping is on).
 * With `wizard` (someone's first product) it is three short steps; otherwise it is the full form.
 */
export function NewProductForm({ wizard = false }: { wizard?: boolean }) {
  const router = useRouter();
  const plan = usePlan();
  const store = useCurrentStore();
  // Prices are set in the store's currency: wait for it so the form starts in the right one
  if (!store.data) return <Skeleton className="h-96 rounded-card" />;
  // A store sells one kind, set by physical shipping in Store settings
  const type = store.data.sells;
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
