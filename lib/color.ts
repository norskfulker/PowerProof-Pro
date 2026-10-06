/** WCAG contrast helpers. Used to keep creator-chosen colours readable. */

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().replace("#", "");
  const full = m.length === 3 ? m.split("").map((x) => x + x).join("") : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const INK = "#0C1F1B";
const PORCELAIN = "#F5F6F4";

/** The preferred colour if it reads on the background, otherwise ink or porcelain, whichever reads better. */
export function readableOn(bg: string, preferred?: string, min = 4.5): string {
  if (preferred && contrast(preferred, bg) >= min) return preferred;
  return contrast(INK, bg) >= contrast(PORCELAIN, bg) ? INK : PORCELAIN;
}

function toHex(rgb: number[]): string {
  return "#" + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Mixes `a` toward `b` by t (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return a;
  return toHex(x.map((c, i) => c + (y[i] - c) * t));
}

/**
 * The closest shade of `fg` that reads on `bg` at `min`: lightened on dark backgrounds, darkened
 * on light ones. Used for creator accents in dark stores.
 */
export function liftTo(fg: string, bg: string, min = 4.5): string {
  if (contrast(fg, bg) >= min) return fg;
  const toward = luminance(bg) < 0.2 ? "#FFFFFF" : "#000000";
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mixHex(fg, toward, t);
    if (contrast(c, bg) >= min) return c;
  }
  return toward;
}
