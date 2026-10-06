import { sb } from "../../supabase/browser";
import { SUPABASE_URL } from "../../supabase/env";
import { ApiError } from "../client";
import { activeStoreId } from "./session";

/**
 * Uploads go straight from the browser to Supabase Storage, into the creator's own store folder
 * (`<store id>/…`); storage policies only allow that folder. XHR rather than fetch so the UI keeps
 * its progress bar.
 */

export type Bucket = "store-media" | "product-files";

const LIMITS: Record<Bucket, number> = { "store-media": 10 * 1024 * 1024, "product-files": 50 * 1024 * 1024 };
export const PRODUCT_FILE_MAX = LIMITS["product-files"];

function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "file";
  return ext ? `${base}.${ext}` : base;
}

export async function uploadToStorage(
  bucket: Bucket,
  folder: string,
  file: File,
  opts: { onProgress?: (pct: number) => void; signal?: AbortSignal } = {}
): Promise<{ path: string; publicUrl?: string }> {
  if (file.size > LIMITS[bucket]) {
    throw new ApiError(`${file.name} is over ${LIMITS[bucket] / 1024 / 1024} MB. Make it smaller or split it into parts.`, "validation");
  }
  const storeId = await activeStoreId();
  const path = `${storeId}/${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("Your session has ended. Log in again.", "not_found");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new ApiError(`${file.name} is too big for this kind of file.`, "validation"));
      else if (xhr.status === 415 || /mime/i.test(xhr.responseText)) reject(new ApiError(`${file.name} isn't a file type we can take here.`, "validation"));
      else reject(new ApiError("The upload didn't finish. Check your connection and try again."));
    };
    xhr.onerror = () => reject(new ApiError("The upload didn't finish. Check your connection and try again."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    opts.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });

  const publicUrl = bucket === "store-media" ? sb().storage.from(bucket).getPublicUrl(path).data.publicUrl : undefined;
  return { path, publicUrl };
}

/** Removes files from the creator's own store folder. Missing files are fine. */
export async function removeFromStorage(bucket: Bucket, paths: string[]) {
  if (paths.length) await sb().storage.from(bucket).remove(paths);
}

/** The storage path behind a public store-media URL, if it is one of ours. */
export function storagePathOf(url: string, bucket: Bucket = "store-media"): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i >= 0 && url.startsWith(SUPABASE_URL) ? decodeURIComponent(url.slice(i + marker.length)) : null;
}
