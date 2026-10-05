/**
 * Uploaded media for store pages. In this frontend-only build, uploads live in the browser's
 * IndexedDB (localStorage is far too small for video) and pages refer to them as "asset:<id>".
 * When the backend lands, putAsset uploads to storage and returns a CDN URL instead.
 */

export const MB = 1024 * 1024;

export const MEDIA_LIMITS = {
  image: { max: 5 * MB, types: ["image/jpeg", "image/png", "image/webp", "image/avif"], label: "JPG, PNG, WebP or AVIF up to 5 MB" },
  gif: { max: 5 * MB, types: ["image/gif"], label: "GIF up to 5 MB" },
  video: { max: 10 * MB, types: ["video/mp4", "video/webm"], label: "MP4 or WebM up to 10 MB" },
} as const;

export type MediaKind = keyof typeof MEDIA_LIMITS;

export function mediaKindOf(type: string): MediaKind | undefined {
  return (Object.keys(MEDIA_LIMITS) as MediaKind[]).find((k) => (MEDIA_LIMITS[k].types as readonly string[]).includes(type));
}

/** Plain-words problem with a file, or undefined if it's fine for one of the allowed kinds. */
export function checkMedia(file: { name: string; size: number; type: string }, allowed: MediaKind[]): string | undefined {
  const kind = mediaKindOf(file.type);
  if (!kind || !allowed.includes(kind)) return `${file.name} isn't a file type this block takes. Use ${allowed.map((k) => MEDIA_LIMITS[k].label).join(", or ")}.`;
  if (file.size > MEDIA_LIMITS[kind].max) return `${file.name} is ${(file.size / MB).toFixed(1)} MB. ${kind === "video" ? "Videos" : kind === "gif" ? "GIFs" : "Images"} can be up to ${MEDIA_LIMITS[kind].max / MB} MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* IndexedDB store                                                      */
/* ------------------------------------------------------------------ */

const DB_NAME = "pp-media";
const STORE = "assets";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Storage isn't available in this browser."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Couldn't open storage."));
  });
}

export async function putAsset(file: File): Promise<string> {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ blob: file, name: file.name, type: file.type }, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Couldn't save the file. Your browser storage may be full."));
  });
  db.close();
  return `asset:${id}`;
}

const urls = new Map<string, string>();

/** Object URL for an uploaded asset, or undefined if it isn't in this browser. */
export async function assetUrl(src: string): Promise<string | undefined> {
  if (!src.startsWith("asset:")) return src.startsWith("https://") ? src : undefined;
  const id = src.slice(6);
  if (urls.has(id)) return urls.get(id);
  try {
    const db = await open();
    const rec = await new Promise<{ blob: Blob } | undefined>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result as { blob: Blob } | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!rec) return undefined;
    const url = URL.createObjectURL(rec.blob);
    urls.set(id, url);
    return url;
  } catch {
    return undefined;
  }
}
