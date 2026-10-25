"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Package } from "lucide-react";
import { toast } from "sonner";
import { usePlan } from "@/components/plan/plan-context";
import { SetupJourney } from "@/components/onboarding/setup-journey";
import { PageHeader } from "@/components/pp/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStore } from "@/hooks/use-current-store";
import { createProduct, setProductCollections, updateStore } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ProductForm } from "./product-form";
import { blankProduct, toInput } from "./to-values";

/**
 * A new product of the kind the store sells (digital, or physical once physical shipping is on).
 * With `wizard` (someone's first product) it starts with the choice of physical or digital (which
 * sets what the store sells), then three short steps; after saving, the store is built next.
 * Otherwise it is the full form.
 */
export function NewProductForm({ wizard = false }: { wizard?: boolean }) {
  const router = useRouter();
  const plan = usePlan();
  const store = useCurrentStore();
  const [switching, setSwitching] = useState(false);
  // Prices are set in the store's currency: wait for it so the form starts in the right one
  if (!store.data) return <Skeleton className="h-96 rounded-card" />;
  // A store sells one kind, set by physical shipping in Store settings
  const type = store.data.sells;
  return (
    <>
      {wizard ? (
        <>
          <SetupJourney current={2} />
          <PageHeader title="Add your first product" />
          <div role="radiogroup" aria-label="What are you selling?" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                { value: "digital", icon: FileUp, title: "Digital", body: "A file buyers download: PDF, template, course, audio." },
                { value: "physical", icon: Package, title: "Physical", body: "Something you ship. Adds shipping and stock." },
              ] as const
            ).map((k) => {
              const on = type === k.value;
              return (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={switching}
                  onClick={async () => {
                    if (on) return;
                    setSwitching(true);
                    try {
                      await updateStore({ sells: k.value });
                      await store.reload();
                    } catch (e) {
                      toast.error("Couldn't switch", { description: e instanceof Error ? e.message : undefined });
                    } finally {
                      setSwitching(false);
                    }
                  }}
                  className={cn("flex items-start gap-3 rounded-card border bg-surface p-4 text-left transition-colors disabled:opacity-60", on ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50")}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-control", on ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")}>
                    <k.icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-semibold">{k.title} product</span>
                    <span className="block text-sm text-muted-foreground">{k.body}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <PageHeader
          back={{ href: "/catalog/products/new", label: "Add a product" }}
          title={type === "physical" ? "New physical product" : "New digital product"}
        />
      )}
      <ProductForm
        key={type}
        wizard={wizard}
        initial={blankProduct(type, store.data.currency)}
        submitLabel="Save as draft"
        onSubmit={async (v) => {
          try {
            const p = await createProduct(toInput(v));
            if (v.collectionIds?.length) await setProductCollections(p.id, v.collectionIds);
            toast.success(p.status === "published" ? "Product is live" : "Saved as a draft", { description: p.title });
            // First product: next, build the store around it
            router.push(wizard ? `/store/${store.data!.id}/design?first=1` : "/catalog/products");
          } catch (e) {
            if (!plan.handleLimitError(e)) toast.error("Couldn't create it", { description: e instanceof Error ? e.message : undefined });
            throw e;
          }
        }}
      />
    </>
  );
}
