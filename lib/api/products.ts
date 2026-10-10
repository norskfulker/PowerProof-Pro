import type { Product, ProductFile, ProductInput, ProductKind, ProductStatus } from "../types";
import { PRODUCT_FILE_MAX, uploadToStorage } from "./live/upload";
import { liveChange } from "./live/notify";
import * as live from "./live/catalog";
import { ApiError } from "./client";
import { publishBlockers } from "../../components/products/readiness";

export interface ProductQuery {
  search?: string;
  status?: ProductStatus | "all";
  kind?: ProductKind | "all";
}

export const getProducts = (q: ProductQuery = {}): Promise<Product[]> => live.getProducts(q);
export const getProduct = (id: string): Promise<Product> => live.getProduct(id);
export const createProduct = (input: ProductInput): Promise<Product> => liveChange(live.createProduct(input));
export const updateProduct = (id: string, patch: Partial<ProductInput>): Promise<Product> => liveChange(live.updateProduct(id, patch));
/**
 * Makes a product live (or takes it down). Going live needs what buyers need: a file to download
 * for a digital product, a collection for a physical one. Says plainly what is missing.
 */
export async function publishProduct(id: string): Promise<Product> {
  const p = await live.getProduct(id);
  const blockers = publishBlockers(p, p.fulfilment === "physical" ? (await live.getProductCollectionIds(id)).length > 0 : true);
  if (blockers.length) throw new ApiError(blockers[0], "validation");
  return liveChange(live.updateProduct(id, { status: "published" }));
}
export const unpublishProduct = (id: string): Promise<Product> => liveChange(live.updateProduct(id, { status: "draft" }));
export const deleteProduct = (id: string): Promise<void> => liveChange(live.deleteProduct(id));
export const getProductCollectionIds = (productId: string): Promise<string[]> => live.getProductCollectionIds(productId);
export const setProductCollections = (productId: string, ids: string[]): Promise<void> => liveChange(live.setProductCollections(productId, ids));
export const duplicateProduct = (id: string): Promise<Product> => liveChange(live.duplicateProduct(id));

/** Largest file a buyer can be sent: the private bucket's limit. */
export const PRODUCT_FILE_MAX_BYTES = PRODUCT_FILE_MAX;

/**
 * Uploads a file buyers will receive to private storage in the store's folder. It is attached to
 * the product when the product is saved; buyers only ever get short-lived links.
 */
export async function uploadProductFile(file: File, opts: { onProgress?: (pct: number) => void; signal?: AbortSignal } = {}): Promise<ProductFile> {
  const base = { id: `f_${Math.random().toString(36).slice(2, 9)}`, name: file.name, size: file.size, mime: file.type || "application/octet-stream" };
  const { path } = await uploadToStorage("product-files", "files", file, opts);
  return { ...base, path };
}
