import { compressImage } from "../media/compress";
import { checkMedia, mediaKindOf, measureMedia, MB, type MediaKind } from "../media/store";
import { formatBytes } from "../money";
import { STORAGE_QUOTA_BYTES } from "../plans";
import { fontExt, fontFileError, fontFormat, fontLabel, fontMime, looksLikeFont } from "../fonts";
import type { CustomFont, MediaItem } from "../types";
import { ApiError } from "./client";
import { uploadToStorage } from "./live/upload";
import * as live from "./live/media";
import { liveChange } from "./live/notify";

/**
 * Media library. Files live in the store's own folder in Supabase Storage and the list is read
 * from there: nothing about the library is kept in the browser.
 */

/** What may actually be stored per file: the bucket takes 10 MB. */
const STORED_MAX: Record<MediaKind, number> = { image: 10 * MB, gif: 5 * MB, video: 10 * MB };

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

/** The library's usage against its 2 GB, for the meter and for refusing uploads that don't fit. */
export async function getStorageUsage(): Promise<{ used: number; files: number; quota: number }> {
  return { ...(await live.getStorageUsage()), quota: STORAGE_QUOTA_BYTES };
}

/** Throws when `incoming` more bytes wouldn't fit in the library. */
export async function assertRoom(incoming: number): Promise<void> {
  const { used, quota } = await getStorageUsage();
  if (used + incoming > quota) throw new ApiError(`Your library is full (${formatBytes(used)} of ${formatBytes(quota)}). Delete files you don't use to free up space.`, "validation");
}

export async function uploadMedia(file: File, opts: UploadOptions): Promise<MediaItem & { saved?: number }> {
  const type = checkMedia(file, opts.kinds);
  if (type) throw new ApiError(type, "validation");
  const kind = mediaKindOf(file.type)!;
  // Photos are shrunk first; the checks and the room test then apply to what is really stored
  const { file: stored, saved } = kind === "image" ? await compressImage(file) : { file, saved: 0 };
  if (stored.size > STORED_MAX[kind]) throw new ApiError(`${file.name} is still ${formatBytes(stored.size)} after shrinking. ${kind === "video" ? "Videos" : kind === "gif" ? "GIFs" : "Images"} can be up to ${formatBytes(STORED_MAX[kind])}.`, "validation");
  await assertRoom(stored.size);
  const { publicUrl } = await uploadToStorage("store-media", "media", stored, { onProgress: opts.onProgress, signal: opts.signal });
  const size = await measureMedia(stored, kind);
  const item: MediaItem = { id: publicUrl!, name: stored.name.replace(/\.[^.]+$/, "") || "Untitled", kind, mime: stored.type, size: stored.size, ...size, src: publicUrl!, alt: opts.alt ?? "", source: "upload", createdAt: new Date().toISOString() };
  return { ...(await liveChange(Promise.resolve(item))), saved };
}

/** A store's own font file. It is checked (type, size, and that the bytes really are a font) and stored with the store's images. */
export async function uploadFont(file: File, opts: { onProgress?: (pct: number) => void } = {}): Promise<CustomFont> {
  const err = fontFileError(file);
  if (err) throw new ApiError(err, "validation");
  const ext = fontExt(file.name)!;
  if (!looksLikeFont(new Uint8Array(await file.slice(0, 4).arrayBuffer()), ext)) throw new ApiError(`${file.name} isn't a real ${ext.toUpperCase()} font file.`, "validation");
  // Browsers often report no type for fonts: say what it is so storage accepts it
  const typed = new File([file], file.name, { type: fontMime(ext) });
  await assertRoom(typed.size);
  const { publicUrl } = await uploadToStorage("store-media", "fonts", typed, { onProgress: opts.onProgress });
  return { name: fontLabel(file.name), src: publicUrl!, format: fontFormat(ext), use: "both" };
}

/** Saves an AI image (or any generated blob) to the library. */
export async function saveGeneratedMedia(blob: Blob, meta: { name: string; prompt: string; width: number; height: number; alt?: string }): Promise<MediaItem> {
  const file = new File([blob], `${meta.name}.png`, { type: "image/png" });
  await assertRoom(blob.size);
  const src = (await uploadToStorage("store-media", "ai", file)).publicUrl!;
  return liveChange(Promise.resolve({ id: src, name: meta.name, kind: "image" as const, mime: "image/png", size: blob.size, width: meta.width, height: meta.height, src, alt: meta.alt ?? meta.prompt.slice(0, 120), source: "ai" as const, createdAt: new Date().toISOString(), prompt: meta.prompt }));
}

export const getMediaLibrary = (q: { search?: string; kind?: MediaItem["kind"] | "ai" } = {}): Promise<MediaListItem[]> => live.getMediaLibrary(q);
export const updateMedia = (_id: string, _patch: { name?: string; alt?: string }): Promise<MediaItem> => live.updateMedia();
/** Deletes a file. Anything still using it shows a placeholder until a new file is chosen. */
export const deleteMedia = (id: string): Promise<void> => liveChange(live.deleteMedia(id));
