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
  // The kind is the first choice. Without one, send people back to make it.
  useEffect(() => {
    if (!known) router.replace("/catalog/products/new");
  }, [known, router]);
  return known ? <NewProductForm type={type} /> : null;
}
