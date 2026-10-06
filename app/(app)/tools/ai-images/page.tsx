"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AiImageMaker } from "@/components/ai/ai-image-maker";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_PRODUCT_IMAGES } from "@/components/products/image-gallery-field";
import { useApi } from "@/hooks/use-api";
import { getProducts, updateProduct } from "@/lib/api";
import { uid } from "@/lib/uid";

export default function ImagesPage() {
  const router = useRouter();
  const products = useApi(() => getProducts(), []);
  const [productId, setProductId] = useState<string>("none");
  const product = products.data?.find((p) => p.id === productId);

  return (
    <>
      <title>AI images · PowerProof</title>
      <PageHeader
        title="AI images"
        description="Describe what you want. You get four to choose from. Everything you keep goes into your media library."
        actions={
          <div className="flex w-full flex-col gap-1.5 sm:w-72">
            <Label htmlFor="im-product" className="text-sm">Use it for</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="im-product" className="w-full">
                <SelectValue placeholder={products.loading ? "Loading products…" : "Choose a product"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Just save to my library</SelectItem>
                {products.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>Cover for {p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <AiImageMaker
        onUse={async (m) => {
          if (!product) {
            toast.success("Saved to your media library", {
              action: { label: "Open library", onClick: () => router.push("/catalog/media") },
            });
            return;
          }
          const images = [{ id: uid("img"), src: m.src, alt: m.alt || `${product.title} cover` }, ...product.images].slice(0, MAX_PRODUCT_IMAGES);
          await updateProduct(product.id, { images });
          toast.success("Added as the cover", { description: product.title });
          router.push(`/catalog/products/${product.id}`);
        }}
      />
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        Looking for something you made earlier?
        <Button asChild variant="secondary" size="sm"><Link href="/catalog/media">Open your media library</Link></Button>
      </div>
    </>
  );
}
