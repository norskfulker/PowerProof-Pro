import { contrast, parseHex, readableOn } from "../color";
import type { TileBackground } from "../types";

/** A colour darkened by a black overlay of the given strength (0 to 1). */
export function withOverlay(hex: string, overlay = 0): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const k = 1 - Math.max(0, Math.min(1, overlay));
  return `#${rgb.map((c) => Math.round(c * k).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The colour text sits on: the colour itself, or the image's average colour (sampled in the
 * browser) under the overlay. Unknown images are treated as mid-grey, the hardest case.
 */
export function effectiveBackground(bg: TileBackground, imageAverage?: string): string {
  const base = bg.kind === "color" ? bg.color : imageAverage ?? "#808080";
  return withOverlay(base, bg.overlay ?? 0);
}

export function tileTextColor(bg: TileBackground, imageAverage?: string): string {
  return readableOn(effectiveBackground(bg, imageAverage));
}

/** Plain-words warning when text on this background is hard to read (below 4.5:1), else undefined. */
export function tileContrastWarning(bg: TileBackground, imageAverage?: string): { message: string; ratio: number; suggestOverlay?: number } | undefined {
  const eff = effectiveBackground(bg, imageAverage);
  const ratio = contrast(readableOn(eff), eff);
  if (ratio >= 4.5) return undefined;
  // Smallest overlay (in 5% steps, up to 80%) that makes light text readable
  let suggest: number | undefined;
  const base = bg.kind === "color" ? bg.color : imageAverage ?? "#808080";
  for (let o = 0.05; o <= 0.8; o += 0.05) {
    const e = withOverlay(base, o);
    if (contrast("#F5F6F4", e) >= 4.5) {
      suggest = Math.round(o * 100) / 100;
      break;
    }
  }
  return {
    ratio,
    suggestOverlay: suggest,
    message: bg.kind === "color" ? `Text on this colour is hard to read (${ratio.toFixed(1)}:1, aim for 4.5:1). Pick a darker or lighter colour, or add an overlay.` : `Text on this ${bg.kind === "video" ? "video" : "image"} may be hard to read (${ratio.toFixed(1)}:1). Add an overlay to darken it.`,
  };
}
