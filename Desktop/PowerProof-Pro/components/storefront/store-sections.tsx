"use client";

import { StoreProductCard, type CardProduct } from "@/components/pp/store-product-card";
import { cn } from "@/lib/utils";
import { useStorefront } from "./storefront-context";

export function ProductGrid({ products, className }: { products: CardProduct[]; className?: string }) {
  const { slug, currency, buy, buying } = useStorefront();
  return (
    <ul className={cn("grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4", className)}>
      {products.map((p) => (
        <li key={p.id}>
          <StoreProductCard product={p} href={`/s/${slug}/${p.slug}`} currency={currency} onBuy={() => buy({ productId: p.id })} buying={buying === p.id} />
        </li>
      ))}
    </ul>
  );
}
