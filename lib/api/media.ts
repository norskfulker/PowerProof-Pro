import { checkMedia, mediaKindOf, measureMedia, type MediaKind } from "../media/store";
import type { MediaItem } from "../types";
import { ApiError } from "./client";
import { uploadToStorage } from "./live/upload";
import * as live from "./live/media";
import { liveChange } from "./live/notify";

/**
 * Media library. Files live in the store's own folder in Supabase Storage and the list is read
 * from there: nothing about the library is kept in the browser.
 */

export interface UploadOptions {
  /** Kinds this field takes */
  kinds: MediaKind[];
  /** 0 to 100 */
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
  alt?: string;
}

export interface MediaUse {
  label: string;
  href: string;
}

export interface MediaListItem extends MediaItem {
  uses: MediaUse[];
}

export async function uploadMedia(file: File, opts: UploadOptions): Promise<MediaItem> {
  const problem = checkMedia(file, opts.kinds);
  if (problem) throw new ApiError(problem, "validation");
  const kind = mediaKindOf(file.type)!;
  const { publicUrl } = await uploadToStorage("store-media", "media", file, { onProgress: opts.onProgress, signal: opts.signal });
  const size = await measureMedia(file, kind);
  const item: MediaItem = { id: publicUrl!, name: file.name.replace(/\.[^.]+$/, "") || "Untitled", kind, mime: file.type, size: file.size, ...size, src: publicUrl!, alt: opts.alt ?? "", source: "upload", createdAt: new Date().toISOString() };
  return liveChange(Promise.resolve(item));
}

/** Saves an AI image (or any generated blob) to the library. */
export async function saveGeneratedMedia(blob: Blob, meta: { name: string; prompt: string; width: number; height: number; alt?: string }): Promise<MediaItem> {
  const file = new File([blob], `${meta.name}.png`, { type: "image/png" });
  const src = (await uploadToStorage("store-media", "ai", file)).publicUrl!;
  return liveChange(Promise.resolve({ id: src, name: meta.name, kind: "image" as const, mime: "image/png", size: blob.size, width: meta.width, height: meta.height, src, alt: meta.alt ?? meta.prompt.slice(0, 120), source: "ai" as const, createdAt: new Date().toISOString(), prompt: meta.prompt }));
}

export const getMediaLibrary = (q: { search?: string; kind?: MediaItem["kind"] | "ai" } = {}): Promise<MediaListItem[]> => live.getMediaLibrary(q);
export const updateMedia = (_id: string, _patch: { name?: string; alt?: string }): Promise<MediaItem> => live.updateMedia();
/** Deletes a file. Anything still using it shows a placeholder until a new file is chosen. */
export const deleteMedia = (id: string): Promise<void> => liveChange(live.deleteMedia(id));
