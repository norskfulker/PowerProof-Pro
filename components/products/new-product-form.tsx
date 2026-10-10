"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePlan } from "@/components/plan/plan-context";
import { PageHeader } from "@/components/pp/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStore } from "@/hooks/use-current-store";
import { createProduct, setProductCollections } from "@/lib/api";
import { ProductForm } from "./product-form";
import { blankProduct, toInput } from "./to-values";

/**
 * A new product of the kind picked. With `wizard` (someone's first product) it is three short
 * steps and the kind is picked inside them; otherwise it is the full form.
 */
export function NewProductForm({ type, wizard = false }: { type: "digital" | "physical"; wizard?: boolean }) {
  const router = useRouter();
  const plan = usePlan();
  const store = useCurrentStore();
  // Prices are set in the store's currency: wait for it so the form starts in the right one
  if (!store.data) return <Skeleton className="h-96 rounded-card" />;
  return (
    <>
      {wizard ? (
        <PageHeader title="Add your first product" description="Three short steps. You can change anything afterwards." />
      ) : (
        <PageHeader
          back={{ href: "/catalog/products/new", label: "Digital or physical" }}
          title={type === "physical" ? "New physical product" : "New digital product"}
          description={type === "physical" ? "Add a name, a price and the collection it belongs to. Everything else is optional." : "Add the file, a name and a price. Everything else is optional."}
        />
      )}
      <ProductForm
        wizard={wizard}
        initial={blankProduct(type, store.data.currency)}
        submitLabel="Create product"
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
