import type { Product, ProductInput } from "@/lib/types";
import type { ProductValues } from "./product-schema";

export function toValues(p: Pick<Product, keyof ProductInput> & { sourceUrl?: string; compareAt?: Product["compareAt"] }, collectionIds: string[] = []): ProductValues {
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
    video: p.video,
    tileBackground: p.tileBackground,
    collectionIds,
  };
}

export function toInput(v: ProductValues): ProductInput {
  // Collections are saved separately, after the product
  const { collectionIds: _collections, ...rest } = v;
  void _collections;
  return {
    ...rest,
    images: v.images as ProductInput["images"],
    video: v.video as ProductInput["video"],
    tileBackground: v.tileBackground as ProductInput["tileBackground"],
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
  collectionIds: [],
};
