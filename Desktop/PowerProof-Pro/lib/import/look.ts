import { schemesOf } from "../store-themes";
import type { FontPairId, PaletteId, StoreTheme } from "../types";
import { PALETTES } from "../store-themes";

/** Another store's look, as read from its address (lib/server/import/theme.ts) */
export interface CopiedLook {
  url: string;
  title: string;
  /** Shopify, WooCommerce, Wix… or Website */
  platform: string;
  /** Shopify's theme name (Dawn, Prestige…) when it says */
  themeName?: string;
  colors: { background: string; text: string; primary: string; accent?: string; buttonText: string };
  dark: boolean;
  /** The font names it uses */
  fonts: { heading?: string; body?: string };
  /** Our closest pairing */
  fontPair: FontPairId;
  corners?: "sharp" | "soft" | "round";
  /** Its home page's sections, in order, as our ready-made sections (lib/pages/templates.ts) */
  sections: { preset: string; source: string }[];
}

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const distance = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** Mixes two colours: t = 0 is a, 1 is b */
function mix(a: string, b: string, t: number) {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * The store's theme with the copied look: brand and accent colours, the nearest palette (so dark
 * mode and the other schemes still fit), the font pairing, corners, and a first colour scheme that
 * matches the site's own page colours exactly.
 */
export function themeWithLook(theme: StoreTheme, look: CopiedLook): StoreTheme {
  const palette = PALETTES.reduce((best, p) => (distance(p.primary, look.colors.primary) < distance(best.primary, look.colors.primary) ? p : best), PALETTES[0]).id as PaletteId;
  const next: StoreTheme = { ...theme, palette, brand: look.colors.primary, accent: look.colors.accent ?? theme.accent, fonts: look.fontPair, corners: look.corners ?? theme.corners, mode: look.dark ? "dark" : theme.mode === "dark" ? "light" : theme.mode, schemes: undefined };
  const schemes = schemesOf(next).map((s) => ({ ...s, light: { ...s.light }, dark: { ...s.dark } }));
  const page = { background: look.colors.background, text: look.colors.text, button: look.colors.primary, buttonText: look.colors.buttonText, border: mix(look.colors.background, look.colors.text, 0.15) };
  if (schemes[0]) {
    if (look.dark) schemes[0].dark = page;
    else schemes[0].light = page;
  }
  return { ...next, schemes };
}
