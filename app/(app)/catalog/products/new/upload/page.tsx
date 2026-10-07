"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePlan } from "@/components/plan/plan-context";
import { PageHeader } from "@/components/pp/page-header";
import { ProductForm } from "@/components/products/product-form";
import { BLANK_PRODUCT, toInput } from "@/components/products/to-values";
import { createProduct, setProductCollections } from "@/lib/api";

export default function UploadProductPage() {
  const router = useRouter();
  const plan = usePlan();
  return (
    <>
      <PageHeader back={{ href: "/catalog/products/new", label: "Add a product" }} eyebrow="Upload a file" title="New product" description="Add the file, a name and a price. Everything else is optional." />
      <ProductForm
        initial={BLANK_PRODUCT}
        submitLabel="Create product"
        onSubmit={async (v) => {
          try {
            const p = await createProduct(toInput(v));
            if (v.collectionIds?.length) await setProductCollections(p.id, v.collectionIds);
            toast.success(p.status === "published" ? "Product is live" : "Saved as a draft", { description: p.title });
            router.push("/catalog/products");
          } catch (e) {
            if (!plan.handleLimitError(e)) toast.error("Couldn't create it", { description: e instanceof Error ? e.message : undefined });
            throw e;
          }
        }}
      />
    </>
  );
}
