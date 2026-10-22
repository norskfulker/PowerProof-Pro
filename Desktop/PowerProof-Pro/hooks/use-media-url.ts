"use client";

/**
 * Turns a media source into something an <img> or <video> can show. Files live in Supabase
 * Storage and come as https URLs; anything else (a blob: preview while uploading, an inline
 * image) passes straight through. `missing` is true for a source that can't be shown.
 */
export function useMediaUrl(src: string | undefined): { url?: string; missing: boolean; loading: boolean } {
  if (!src) return { missing: false, loading: false };
  if (src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("data:image/")) return { url: src, missing: false, loading: false };
  return { missing: true, loading: false };
}
