"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewProductForm } from "@/components/products/new-product-form";

export default function UploadProductPage() {
  return (
    <Suspense>
      <NewProduct />
    </Suspense>
  );
}

function NewProduct() {
  const router = useRouter();
  const type = useSearchParams().get("type");
  const known = type === "digital" || type === "physical";
  // Old links without a kind go back to the start. The kind itself is the store's (Store settings).
  useEffect(() => {
    if (!known) router.replace("/catalog/products/new");
  }, [known, router]);
  return known ? <NewProductForm /> : null;
}
