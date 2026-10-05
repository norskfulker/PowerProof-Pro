import type { Product, ProductInput } from "@/lib/types";
import type { ProductValues } from "./product-schema";

export function toValues(p: Pick<Product, keyof ProductInput> & { sourceUrl?: string; compareAt?: Product["compareAt"] }): ProductValues {
  return {
    title: p.title,
    description: p.description,
    kind: p.kind,
    price: { amount: p.price.amount, currency: "INR" },
    compareAt: p.compareAt ? { amount: p.compareAt.amount, currency: "INR" } : undefined,
    images: p.images,
    files: p.files,
    sku: p.sku,
    taxCode: p.taxCode,
    status: p.status,
    sourceUrl: p.sourceUrl,
  };
}

export function toInput(v: ProductValues): ProductInput {
  return {
    ...v,
    images: v.images as ProductInput["images"],
  };
}

export const BLANK_PRODUCT: ProductValues = {
  title: "",
  description: "",
  kind: "other",
  price: { amount: 49900, currency: "INR" },
  images: [],
  files: [],
  sku: "",
  taxCode: "998433",
  status: "draft",
};
