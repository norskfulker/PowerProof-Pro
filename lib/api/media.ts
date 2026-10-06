import { checkMedia, deleteAsset, mediaKindOf, measureMedia, putAsset, type MediaKind } from "../media/store";
import { commit, db, getDemo } from "../mock/db";
import { uid } from "../mock/random";
import type { MediaItem } from "../types";
import { ApiError, call, notFound } from "./client";
import { ownedScopes } from "./scope";
import { isLive } from "../supabase/env";
import { uploadToStorage } from "./live/upload";
import * as live from "./live/media";
import { liveChange } from "./live/notify";

/**
 * Media library (Part 6A). Uploads are mocked: progress is simulated and the file stays in this
 * browser (IndexedDB, shown through object URLs). With a backend, `uploadMedia` posts the file
 * and returns a CDN URL instead; the signatures stay the same.
 */

export interface UploadOptions {
  /** Kinds this field takes */
  kinds: MediaKind[];
  /** 0 to 100 */
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
  alt?: string;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Upload cancelled", "AbortError"));
    });
  });

export async function uploadMedia(file: File, opts: UploadOptions): Promise<MediaItem> {
  const problem = checkMedia(file, opts.kinds);
  if (problem) throw new ApiError(problem, "validation");
  const kind = mediaKindOf(file.type)!;
  if (isLive()) {
    // Live: the file goes to the store's public media folder; the library list stays in this browser
    const { publicUrl } = await uploadToStorage("store-media", "media", file, { onProgress: opts.onProgress, signal: opts.signal });
    const size = await measureMedia(file, kind);
    const item: MediaItem = { id: publicUrl!, name: file.name.replace(/\.[^.]+$/, "") || "Untitled", kind, mime: file.type, size: file.size, ...size, src: publicUrl!, alt: opts.alt ?? "", source: "upload", createdAt: new Date().toISOString() };
    return liveChange(Promise.resolve(item));
  }
  // Simulated upload: roughly 1 second per 4 MB, at least half a second
  const steps = 10;
  const total = Math.max(500, Math.min(2500, (file.size / (4 * 1024 * 1024)) * 1000));
  for (let i = 1; i <= steps; i++) {
    await sleep(total / steps, opts.signal);
    opts.onProgress?.(Math.round((i / steps) * 100));
    if (getDemo().fail && i === 6) throw new ApiError("The upload didn't finish. Check your connection and try again.");
  }
  let src: string;
  try {
    src = await putAsset(file);
  } catch {
    throw new ApiError("Your browser couldn't store this file. Free up some space and try again.");
  }
  const size = await measureMedia(file, kind);
  const item: MediaItem = {
    id: uid("med"),
    name: file.name.replace(/\.[^.]+$/, "") || "Untitled",
    kind,
    mime: file.type,
    size: file.size,
    ...size,
    src,
    alt: opts.alt ?? "",
    source: "upload",
    createdAt: new Date().toISOString(),
  };
  commit((d) => d.media.unshift(item));
  return item;
}

/** Saves an AI image (or any generated blob) to the library. */
export async function saveGeneratedMedia(blob: Blob, meta: { name: string; prompt: string; width: number; height: number; alt?: string }): Promise<MediaItem> {
  const file = new File([blob], `${meta.name}.png`, { type: "image/png" });
  if (isLive()) {
    const src = (await uploadToStorage("store-media", "ai", file)).publicUrl!;
    return liveChange(Promise.resolve({ id: src, name: meta.name, kind: "image" as const, mime: "image/png", size: blob.size, width: meta.width, height: meta.height, src, alt: meta.alt ?? meta.prompt.slice(0, 120), source: "ai" as const, createdAt: new Date().toISOString(), prompt: meta.prompt }));
  }
  const src = await putAsset(file);
  const item: MediaItem = { id: uid("med"), name: meta.name, kind: "image", mime: "image/png", size: blob.size, width: meta.width, height: meta.height, src, alt: meta.alt ?? meta.prompt.slice(0, 120), source: "ai", createdAt: new Date().toISOString(), prompt: meta.prompt };
  commit((d) => d.media.unshift(item));
  return item;
}

export interface MediaUse {
  label: string;
  href: string;
}

/** Everywhere a file is used, across all of the creator's stores. */
function usesOf(src: string): MediaUse[] {
  const out: MediaUse[] = [];
  const has = (v: unknown) => JSON.stringify(v ?? null).includes(`"${src}"`);
  for (const sc of ownedScopes()) {
    const tag = ownedScopes().length > 1 ? ` · ${sc.store.name}` : "";
    for (const p of sc.products) {
      if (p.images.some((i) => i.src === src)) out.push({ label: `Product image: ${p.title}${tag}`, href: `/catalog/products/${p.id}` });
      if (p.video?.src === src || p.video?.poster === src) out.push({ label: `Product video: ${p.title}${tag}`, href: `/catalog/products/${p.id}` });
      if (has(p.tileBackground)) out.push({ label: `Product card: ${p.title}${tag}`, href: `/catalog/products/${p.id}` });
    }
    for (const c of sc.collections) if (has(c.background)) out.push({ label: `Collection tile: ${c.name}${tag}`, href: "/catalog/collections" });
    if (has(sc.design.hero.background)) out.push({ label: `Store hero${tag}`, href: "/store/current/design/theme" });
    if (sc.store.logo?.src === src) out.push({ label: `Store logo${tag}`, href: "/store/current/settings" });
    if (has(sc.design.about.photo)) out.push({ label: `About page photo${tag}`, href: `/store/${sc.store.id}/pages/about` });
    for (const p of sc.visualPages) if (has(p.draft) || has(p.published)) out.push({ label: `Page: ${p.title}${tag}`, href: `/store/current/design/pages/${p.id}/edit` });
    for (const r of sc.reviews) if (r.photos.some((ph) => ph.src === src)) out.push({ label: `Review photo: “${r.title}”${tag}`, href: "/store/current/reviews" });
  }
  return out;
}

export interface MediaListItem extends MediaItem {
  uses: MediaUse[];
}

export function getMediaLibrary(q: { search?: string; kind?: MediaItem["kind"] | "ai" } = {}): Promise<MediaListItem[]> {
  if (isLive()) return live.getMediaLibrary(q);
  return call(() => {
    const term = q.search?.trim().toLowerCase();
    return db()
      .media.filter((m) => (!q.kind ? true : q.kind === "ai" ? m.source === "ai" : m.kind === q.kind))
      .filter((m) => !term || m.name.toLowerCase().includes(term) || m.alt.toLowerCase().includes(term) || (m.prompt ?? "").toLowerCase().includes(term))
      .map((m) => ({ ...m, uses: usesOf(m.src) }));
  }, { fast: true });
}

export function updateMedia(id: string, patch: { name?: string; alt?: string }): Promise<MediaItem> {
  if (isLive()) return live.updateMedia();
  return call(() => {
    const m = db().media.find((x) => x.id === id) ?? notFound("File");
    if (patch.name !== undefined && !patch.name.trim()) throw new ApiError("Give the file a name.", "validation");
    commit(() => {
      if (patch.name !== undefined) m.name = patch.name.trim().slice(0, 120);
      if (patch.alt !== undefined) m.alt = patch.alt.trim().slice(0, 200);
    });
    return m;
  }, { fast: true });
}

/** Deletes a file. Anything still using it shows a placeholder until a new file is chosen. */
export function deleteMedia(id: string): Promise<void> {
  if (isLive()) return liveChange(live.deleteMedia(id));
  return call(async () => {
    const m = db().media.find((x) => x.id === id) ?? notFound("File");
    commit((d) => (d.media = d.media.filter((x) => x.id !== id)));
    await deleteAsset(m.src);
  });
}
