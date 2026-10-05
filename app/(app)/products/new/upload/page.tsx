"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/pp/page-header";
import { ProductForm } from "@/components/products/product-form";
import { BLANK_PRODUCT, toInput } from "@/components/products/to-values";
import { createProduct } from "@/lib/api";

export default function UploadProductPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader back={{ href: "/products/new", label: "Add a product" }} eyebrow="Upload a file" title="New product" description="Add the file, a name and a price. Everything else is optional." />
      <ProductForm
        initial={BLANK_PRODUCT}
        submitLabel="Create product"
        onSubmit={async (v) => {
          try {
            const p = await createProduct(toInput(v));
            toast.success(p.status === "published" ? "Product is live" : "Saved as a draft", { description: p.title });
            router.push("/products");
          } catch (e) {
            toast.error("Couldn't create it", { description: e instanceof Error ? e.message : undefined });
            throw e;
          }
        }}
      />
    </>
  );
}
