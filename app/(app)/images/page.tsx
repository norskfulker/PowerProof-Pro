"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ImageMaker } from "@/components/pp/image-maker";
import { PageHeader } from "@/components/pp/page-header";
import { useApi } from "@/hooks/use-api";
import { getProducts, updateProduct } from "@/lib/api";
import { uid } from "@/lib/uid";

export default function ImageMakerPage() {
  const router = useRouter();
  const products = useApi(() => getProducts(), []);
  const [productId, setProductId] = useState<string>("none");
  const product = products.data?.find((p) => p.id === productId);

  return (
    <>
      <PageHeader
        title="Image maker"
        description="Covers, posts and link previews in your colours. Export a PNG or add it straight to a product."
        actions={
          <div className="flex w-full flex-col gap-1.5 sm:w-72">
            <Label htmlFor="im-product" className="text-sm">Attach to</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="im-product" className="w-full">
                <SelectValue placeholder={products.loading ? "Loading products…" : "Choose a product"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nothing, just export</SelectItem>
                {products.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <ImageMaker
        key={product?.id ?? "none"}
        initial={product?.images[0]?.cover ? { ...product.images[0].cover } : undefined}
        onUse={
          product
            ? async (spec) => {
                await updateProduct(product.id, { images: [{ id: uid("img"), alt: `${spec.title} cover`, cover: spec }, ...product.images] });
                toast.success("Added as the cover", { description: product.title });
                router.push(`/products/${product.id}`);
              }
            : undefined
        }
      />
    </>
  );
}
