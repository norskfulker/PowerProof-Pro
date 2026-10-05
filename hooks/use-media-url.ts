"use client";

import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/media/store";

/**
 * Turns a media source into something an <img> or <video> can show.
 * "asset:<id>" files live in this browser and resolve asynchronously; https URLs pass straight through.
 * `missing` is true when an uploaded file isn't in this browser (deleted, or another device).
 */
export function useMediaUrl(src: string | undefined): { url?: string; missing: boolean; loading: boolean } {
  const [state, setState] = useState<{ src?: string; url?: string; missing: boolean }>({ missing: false });
  useEffect(() => {
    if (!src?.startsWith("asset:")) return;
    let alive = true;
    assetUrl(src).then((url) => alive && setState({ src, url, missing: !url }));
    return () => {
      alive = false;
    };
  }, [src]);
  if (!src) return { missing: false, loading: false };
  if (src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("data:image/")) return { url: src, missing: false, loading: false };
  if (!src.startsWith("asset:")) return { missing: true, loading: false };
  if (state.src !== src) return { missing: false, loading: true };
  return { url: state.url, missing: state.missing, loading: false };
}
