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

const PAGE = 100;

/** Every object in a folder: Storage hands them out a page at a time. */
async function listAll(folder: string) {
  const bucket = sb().storage.from("store-media");
  const out: Awaited<ReturnType<typeof bucket.list>>["data"] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket.list(folder, { limit: PAGE, offset, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw new ApiError("We couldn't load your media. Refresh to try again.");
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return out;
  }
}

/** Bytes this store's library holds (uploads and AI images). */
export async function getStorageUsage(): Promise<{ used: number; files: number }> {
  const storeId = await activeStoreId();
  const lists = await Promise.all(FOLDERS.map(({ folder }) => listAll(`${storeId}/${folder}`)));
  const objects = lists.flat().filter((o) => o?.id && o.name !== ".emptyFolderPlaceholder");
  return { used: objects.reduce((t, o) => t + Number((o.metadata as { size?: number } | null)?.size ?? 0), 0), files: objects.length };
}

export async function listMedia(): Promise<MediaItem[]> {
  const storeId = await activeStoreId();
  const bucket = sb().storage.from("store-media");
  const lists = await Promise.all(
    FOLDERS.map(async ({ folder, source }) => {
      const data = await listAll(`${storeId}/${folder}`);
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
  const [pageRows, draftRows] = await Promise.all([sb().from("custom_pages").select("id, title, slug, layout").eq("store_id", store.id), sb().from("custom_page_drafts").select("page_id, data").eq("store_id", store.id)]);
  // Drafts (unpublished work) count too; before migration 031 there is no drafts table and they're in layout
  const drafts = new Map((draftRows.data ?? []).map((d) => [d.page_id, d.data]));
  const pages = (pageRows.data ?? []).map((p) => ({ title: p.title, slug: p.slug, layout: [p.layout, drafts.get(p.id)] }));
  const has = (v: unknown, src: string) => JSON.stringify(v ?? null).includes(`"${src}"`);
  return (src) => {
    const out: MediaUse[] = [];
    for (const p of products) {
      if (p.images.some((i) => i.src === src)) out.push({ label: `Product image: ${p.title}`, href: `/catalog/products/${p.id}` });
      if (p.video?.src === src || p.video?.poster === src) out.push({ label: `Product video: ${p.title}`, href: `/catalog/products/${p.id}` });
      if (has(p.tileBackground, src)) out.push({ label: `Product card: ${p.title}`, href: `/catalog/products/${p.id}` });
    }
    for (const c of collections) if (has(c.background, src)) out.push({ label: `Collection tile: ${c.name}`, href: "/catalog/collections" });
    if (has(design.hero.background, src)) out.push({ label: "Store hero", href: "/store/current/design/pages/home/edit" });
    for (const pg of pages) if (has(pg.layout, src)) out.push({ label: pg.slug === "home" ? "Home page" : `Page: ${pg.title}`, href: "/store/current/design/pages" });
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
