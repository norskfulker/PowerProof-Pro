import type { ImportPreview } from "../import/map";
import { ApiError } from "./client";

/**
 * Adding products from a link (Products › From a link). The server reads the page; products are
 * then created here with the normal product calls, so plan limits and checks are the same as adding
 * them by hand.
 */
export type { ImportedProduct, ImportPreview } from "../import/map";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = (await res.json().catch(() => ({ ok: false, message: "Something went wrong. Try again." }))) as T & { ok: boolean; message?: string };
  if (!out.ok) throw new ApiError(out.message ?? "That didn't work.", res.status === 404 ? "not_found" : "validation");
  return out;
}

export type PreviewReply = { importId: string; preview: ImportPreview; existing: string[]; proof: { method: string; detail: string } };

export interface PreviewInput {
  storeId: string;
  source: "link";
  url: string;
  /** The creator confirms they own these products or may sell them */
  rights: boolean;
  /** Bring pictures and video too */
  media?: boolean;
}

/** Reads a product page or a shop's address */
export const previewImport = (input: PreviewInput): Promise<PreviewReply> => post<PreviewReply>("/api/import/preview", input);

/** Copies pictures (and product videos: MP4 or WebM, 10 MB at most) into the store's media library: source address → new address (null when it couldn't be copied) */
export async function copyImages(storeId: string, urls: string[]): Promise<Record<string, string | null>> {
  if (!urls.length) return {};
  return (await post<{ urls: Record<string, string | null> }>("/api/import/media", { storeId, urls })).urls;
}
