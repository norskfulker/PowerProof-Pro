import type { CurrencyCode, Product, ProductInput } from "@/lib/types";
import type { ProductValues } from "./product-schema";

export function toValues(p: Pick<Product, keyof ProductInput> & { sourceUrl?: string; compareAt?: Product["compareAt"] }, collectionIds: string[] = []): ProductValues {
  return {
    title: p.title,
    description: p.description,
    kind: p.kind,
    fulfilment: p.fulfilment,
    price: { amount: p.price.amount, currency: p.price.currency },
    compareAt: p.compareAt ? { amount: p.compareAt.amount, currency: p.compareAt.currency } : undefined,
    images: p.images,
    files: p.files,
    sku: p.sku,
    taxCode: p.taxCode,
    taxRate: p.taxRate,
    status: p.status,
    sourceUrl: p.sourceUrl,
    video: p.video,
    tileBackground: p.tileBackground,
    collectionIds,
    options: p.options ?? [],
    variants: (p.variants ?? []).map((v) => ({ ...v, price: { amount: v.price.amount, currency: v.price.currency }, compareAt: v.compareAt ? { amount: v.compareAt.amount, currency: v.compareAt.currency } : undefined })),
    trackStock: p.trackStock ?? false,
    stock: p.stock,
  };
}

export function toInput(v: ProductValues): ProductInput {
  // Collections are saved separately, after the product
  const { collectionIds: _collections, ...rest } = v;
  void _collections;
  const physical = v.fulfilment === "physical";
  return {
    ...rest,
    // Variants, options and stock belong to physical products
    options: physical ? v.options ?? [] : [],
    variants: physical ? (v.variants ?? []).map((x) => ({ ...x, title: x.title || x.options.join(" / ") })) : [],
    trackStock: physical ? !!v.trackStock : false,
    stock: physical && v.trackStock && !(v.variants ?? []).length ? v.stock ?? 0 : undefined,
    images: v.images as ProductInput["images"],
    video: v.video as ProductInput["video"],
    tileBackground: v.tileBackground as ProductInput["tileBackground"],
  };
}

/** A new product of the kind picked first. A physical product starts with no tax code: goods use HSN codes, which are yours to enter. */
export const blankProduct = (fulfilment: "digital" | "physical" = "digital", currency: CurrencyCode = "INR"): ProductValues => ({
  title: "",
  description: "",
  kind: "other",
  fulfilment,
  price: { amount: 49900, currency },
  images: [],
  files: [],
  sku: "",
  taxCode: fulfilment === "physical" ? "" : "998433",
  taxRate: fulfilment === "physical" ? undefined : 18,
  status: "draft",
  collectionIds: [],
  options: [],
  variants: [],
  trackStock: false,
});

export const BLANK_PRODUCT: ProductValues = blankProduct("digital");
