"use client";

import { Suspense } from "react";
import { ProductBrowser } from "@/components/storefront/product-browser";
import { useStorefront } from "@/components/storefront/storefront-context";

function Inner() {
  const { view } = useStorefront();
  return <ProductBrowser title="All products" description={`Everything from ${view.store.name}. Instant download after paying.`} />;
}

export default function StoreProductsPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
