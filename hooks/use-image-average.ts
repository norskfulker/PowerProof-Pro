"use client";

import { useEffect, useState } from "react";
import { useMediaUrl } from "./use-media-url";

/**
 * The average colour of an image (read at 16×16 in a canvas), so contrast checks use the real
 * picture. Undefined while loading, or when the image can't be read (cross-origin URLs).
 */
export function useImageAverage(src: string | undefined): string | undefined {
  const { url } = useMediaUrl(src);
  const [avg, setAvg] = useState<{ url: string; hex?: string }>();
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 16;
        c.height = 16;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
        }
        const n = d.length / 4;
        const hex = `#${[r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("")}`;
        if (alive) setAvg({ url, hex });
      } catch {
        if (alive) setAvg({ url });
      }
    };
    img.onerror = () => alive && setAvg({ url });
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return avg && avg.url === url ? avg.hex : undefined;
}
