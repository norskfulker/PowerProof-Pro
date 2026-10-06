import { mediaKindOf } from "../../media/store";
import { sb } from "../../supabase/browser";
import type { MediaItem } from "../../types";
import { ApiError } from "../client";
import type { MediaListItem, MediaUse } from "../media";
import { getCollections, getProducts } from "./catalog";
import { activeStoreId } from "./session";
import { getStore, getStoreDesign } from "./store";
import { removeFromStorage } from "./upload";

/**
 * The media library is the store's own folder in Storage (`store-media/<store id>/media` for
 * uploads, `/ai` for AI images). Nothing about it is kept in the browser.
 */

const FOLDERS = [
  { folder: "media", source: "upload" as const },
  { folder: "ai", source: "ai" as const },
];

/** "9b2…-summer-sale.png" → "summer-sale" */
const displayName = (file: string) => file.replace(/^[0-9a-f-]{36}-/i, "").replace(/\.[^.]+$/, "") || "Untitled";

export async function listMedia(): Promise<MediaItem[]> {
  const storeId = await activeStoreId();
  const bucket = sb().storage.from("store-media");
  const lists = await Promise.all(
    FOLDERS.map(async ({ folder, source }) => {
      const { data, error } = await bucket.list(`${storeId}/${folder}`, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw new ApiError("We couldn't load your media. Refresh to try again.");
      return (data ?? [])
        .filter((o) => o.id && o.name !== ".emptyFolderPlaceholder")
        .map((o): MediaItem | null => {
          const path = `${storeId}/${folder}/${o.name}`;
          const mime = (o.metadata as { mimetype?: string } | null)?.mimetype ?? "";
          const kind = mediaKindOf(mime);
          if (!kind) return null;
          return {
            id: path,
            name: displayName(o.name),
            kind,
            mime,
            size: Number((o.metadata as { size?: number } | null)?.size ?? 0),
            src: bucket.getPublicUrl(path).data.publicUrl,
            alt: "",
            source,
            createdAt: o.created_at ?? new Date().toISOString(),
          };
        })
        .filter((m): m is MediaItem => m !== null);
    })
  );
  return lists.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Where each file is used in the active store, so deleting warns about it. */
async function usesBySrc(): Promise<(src: string) => MediaUse[]> {
  const [products, collections, design, store] = await Promise.all([getProducts(), getCollections(), getStoreDesign(), getStore()]);
  const has = (v: unknown, src: string) => JSON.stringify(v ?? null).includes(`"${src}"`);
  return (src) => {
    const out: MediaUse[] = [];
    for (const p of products) {
      if (p.images.some((i) => i.src === src)) out.push({ label: `Product image: ${p.title}`, href: `/catalog/products/${p.id}` });
      if (p.video?.src === src || p.video?.poster === src) out.push({ label: `Product video: ${p.title}`, href: `/catalog/products/${p.id}` });
      if (has(p.tileBackground, src)) out.push({ label: `Product card: ${p.title}`, href: `/catalog/products/${p.id}` });
    }
    for (const c of collections) if (has(c.background, src)) out.push({ label: `Collection tile: ${c.name}`, href: "/catalog/collections" });
    if (has(design.hero.background, src)) out.push({ label: "Store hero", href: "/store/current/design/theme" });
    if (store.logo?.src === src) out.push({ label: "Store logo", href: "/store/current/settings" });
    if (has(design.about.photo, src)) out.push({ label: "About page photo", href: `/store/${store.id}/pages/about` });
    return out;
  };
}

export async function getMediaLibrary(q: { search?: string; kind?: MediaItem["kind"] | "ai" } = {}): Promise<MediaListItem[]> {
  const term = q.search?.trim().toLowerCase();
  const [items, uses] = await Promise.all([listMedia(), usesBySrc()]);
  return items
    .filter((m) => (!q.kind ? true : q.kind === "ai" ? m.source === "ai" : m.kind === q.kind))
    .filter((m) => !term || m.name.toLowerCase().includes(term))
    .map((m) => ({ ...m, uses: uses(m.src) }));
}

export async function updateMedia(): Promise<MediaItem> {
  // Renaming would change the file's address and break every place it's used
  throw new ApiError("Renaming library files is coming soon. Add alt text where you use the image.", "validation");
}

export async function deleteMedia(id: string): Promise<void> {
  const storeId = await activeStoreId();
  if (!id.startsWith(`${storeId}/`)) throw new ApiError("File not found.", "not_found");
  await removeFromStorage("store-media", [id]);
}
