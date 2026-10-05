/**
 * Uploaded media for store pages. In this frontend-only build, uploads live in the browser's
 * IndexedDB (localStorage is far too small for video) and pages refer to them as "asset:<id>".
 * When the backend lands, putAsset uploads to storage and returns a CDN URL instead.
 */

export const MB = 1024 * 1024;

export const MEDIA_LIMITS = {
  image: { max: 5 * MB, types: ["image/jpeg", "image/png", "image/webp"], label: "JPG, PNG or WebP up to 5 MB" },
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

interface AssetRecord {
  name: string;
  type: string;
  /** Most browsers keep the file itself */
  blob?: Blob;
  /** Some (WebKit in certain modes) can't keep a Blob in IndexedDB; the raw bytes always work */
  bytes?: ArrayBuffer;
}

function write(db: IDBDatabase, id: string, rec: AssetRecord): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rec, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Couldn't save the file. Your browser storage may be full."));
      tx.onabort = () => reject(tx.error ?? new Error("Couldn't save the file."));
    } catch (e) {
      reject(e);
    }
  });
}

export async function putAsset(file: File): Promise<string> {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const db = await open();
  try {
    await write(db, id, { blob: file, name: file.name, type: file.type });
  } catch {
    await write(db, id, { bytes: await file.arrayBuffer(), name: file.name, type: file.type });
  } finally {
    db.close();
  }
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
    const rec = await new Promise<AssetRecord | undefined>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result as AssetRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    const blob = rec?.blob ?? (rec?.bytes ? new Blob([rec.bytes], { type: rec.type }) : undefined);
    if (!blob) return undefined;
    const url = URL.createObjectURL(blob);
    urls.set(id, url);
    return url;
  } catch {
    return undefined;
  }
}

/** Removes an uploaded file from this browser. Remote URLs are left alone. */
export async function deleteAsset(src: string): Promise<void> {
  if (!src.startsWith("asset:")) return;
  const id = src.slice(6);
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* storage unavailable: nothing to delete */
  }
}

/** Width and height of an image or video file, when the browser can read them. */
export async function measureMedia(file: Blob, kind: MediaKind): Promise<{ width?: number; height?: number }> {
  try {
    if (kind === "video") {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.onloadedmetadata = () => resolve();
        v.onerror = () => reject(new Error("unreadable"));
        setTimeout(() => resolve(), 3000);
      });
      URL.revokeObjectURL(url);
      return { width: v.videoWidth || undefined, height: v.videoHeight || undefined };
    }
    const bmp = await createImageBitmap(file);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close();
    return out;
  } catch {
    return {};
  }
}
