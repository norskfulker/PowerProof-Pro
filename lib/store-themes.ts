import { liftTo, mixHex, readableOn } from "./color";
import { FONT_FAMILY, fontFaceCss } from "./fonts";
import type { FontPairId, HeroStyle, PaletteId, SectionId, StoreTheme } from "./types";

/**
 * Store themes override the design tokens inside a store's scope only.
 * Each palette passes AA for text on its background and on its primary.
 */
export interface Palette {
  id: PaletteId;
  name: string;
  background: string;
  surfaceSunken: string;
  muted: string;
  primary: string;
  primaryHover: string;
  primarySoft: string;
  accent: string;
  /** The same palette for dark stores (Part 7A). Primary is lifted so it reads as text. */
  dark: { background: string; surface: string; surfaceSunken: string; muted: string; primary: string; primaryHover: string; primarySoft: string };
}

export const PALETTES: Palette[] = [
  { id: "emerald", name: "Emerald", background: "#F5F6F4", surfaceSunken: "#EEF0EC", muted: "#EEF0EC", primary: "#0F3D33", primaryHover: "#14503F", primarySoft: "#E3ECE8", accent: "#C9A24F", dark: { background: "#0B1614", surface: "#111F1C", surfaceSunken: "#0E1B18", muted: "#182A26", primary: "#2BB093", primaryHover: "#31C9A8", primarySoft: "#183932" } },
  { id: "midnight", name: "Midnight", background: "#F4F5F8", surfaceSunken: "#ECEEF3", muted: "#ECEEF3", primary: "#1E2A4A", primaryHover: "#2A3961", primarySoft: "#E3E7F0", accent: "#D08C3A", dark: { background: "#0B0E16", surface: "#11151F", surfaceSunken: "#0E111B", muted: "#181D2A", primary: "#6F87C8", primaryHover: "#859AD1", primarySoft: "#182139" } },
  { id: "plum", name: "Plum", background: "#F7F4F6", surfaceSunken: "#F0EBEF", muted: "#F0EBEF", primary: "#4A2545", primaryHover: "#5E2F58", primarySoft: "#EEE3EC", accent: "#C98A6B", dark: { background: "#160B15", surface: "#1F111E", surfaceSunken: "#1B0E19", muted: "#2A1828", primary: "#C76BBA", primaryHover: "#CF81C5", primarySoft: "#361B33" } },
  { id: "terracotta", name: "Terracotta", background: "#F8F4F0", surfaceSunken: "#F1EBE4", muted: "#F1EBE4", primary: "#8A3B1E", primaryHover: "#A14725", primarySoft: "#F3E4DC", accent: "#3F7A66", dark: { background: "#160E0B", surface: "#1F1511", surfaceSunken: "#1B110E", muted: "#2A1D18", primary: "#D8714B", primaryHover: "#DD8564", primarySoft: "#392118" } },
  { id: "ocean", name: "Ocean", background: "#F2F6F7", surfaceSunken: "#E8EFF1", muted: "#E8EFF1", primary: "#0E4A5C", primaryHover: "#135C72", primarySoft: "#DFEBEF", accent: "#E0A43B", dark: { background: "#0B1416", surface: "#111C1F", surfaceSunken: "#0E181B", muted: "#18262A", primary: "#1FA4CC", primaryHover: "#2BB5DF", primarySoft: "#183239" } },
  { id: "graphite", name: "Graphite", background: "#F5F5F4", surfaceSunken: "#EDEDEB", muted: "#EDEDEB", primary: "#1F1F1F", primaryHover: "#363636", primarySoft: "#E8E8E6", accent: "#E8613F", dark: { background: "#111111", surface: "#181818", surfaceSunken: "#141414", muted: "#212121", primary: "#A3A3A3", primaryHover: "#B5B5B5", primarySoft: "#292929" } },
];

export const FONT_PAIRS: { id: FontPairId; name: string; display: string; body: string; pair: string }[] = [
  { id: "modern", name: "Modern", display: "var(--font-bricolage)", body: "var(--font-hanken)", pair: "Bricolage Grotesque + Hanken Grotesk" },
  { id: "editorial", name: "Editorial", display: "var(--font-fraunces)", body: "var(--font-hanken)", pair: "Fraunces + Hanken Grotesk" },
  { id: "clean", name: "Clean", display: "var(--font-space)", body: "var(--font-plex-sans)", pair: "Space Grotesk + IBM Plex Sans" },
];

export const HERO_STYLES: { id: HeroStyle; name: string; description: string }[] = [
  { id: "left", name: "Image left", description: "Words on one side, products on the other." },
  { id: "centered", name: "Centered", description: "Big headline in the middle, images below." },
  { id: "full", name: "Full width", description: "Cover image across the top, words on top." },
];

export const SECTION_META: Record<SectionId, { name: string; description: string }> = {
  announcement: { name: "Announcement bar", description: "Offer text, a code and an optional countdown." },
  hero: { name: "Hero", description: "Headline, one button and your best images." },
  highlights: { name: "Highlights strip", description: "Instant download, secure payment, rating, sales." },
  collections: { name: "Collections", description: "Tiles that open filtered product lists." },
  bestsellers: { name: "Bestsellers", description: "Your most bought products." },
  new: { name: "New arrivals", description: "Latest products first." },
  offers: { name: "Offers", description: "Coupons, bundles and the live deal." },
  reviews: { name: "Reviews wall", description: "Top verified reviews and your average." },
  html: { name: "Custom HTML", description: "A section made from an HTML file you upload." },
  about: { name: "About you", description: "Photo, story and social links." },
  faq: { name: "FAQ", description: "Questions you edit in Store › Pages." },
  newsletter: { name: "Newsletter", description: "Collect emails from visitors." },
};

export const DEFAULT_SECTIONS: SectionId[] = ["announcement", "hero", "highlights", "collections", "bestsellers", "new", "offers", "reviews", "html", "about", "faq", "newsletter"];

/** Which theme a store shows: the buyer's own choice, else the creator's default, else the site's. */
export function resolveStoreMode(theme: StoreTheme, siteMode: "light" | "dark", buyer?: "light" | "dark"): "light" | "dark" {
  if (buyer) return buyer;
  const m = theme.mode ?? "auto";
  return m === "auto" ? siteMode : m;
}

/** CSS variables a theme sets on the store's root element, in light or dark. */
export function themeVars(theme: StoreTheme, mode: "light" | "dark" = "light"): Record<string, string> {
  return { ...paletteVars(theme, mode), ...brandVars(theme, mode), ...CORNERS[theme.corners ?? "soft"] };
}

const CORNERS: Record<NonNullable<StoreTheme["corners"]>, Record<string, string>> = {
  sharp: { "--radius-control": "2px", "--radius-card": "4px", "--radius-media": "2px" },
  soft: {},
  round: { "--radius-control": "999px", "--radius-card": "24px", "--radius-media": "20px" },
};

/** The creator's own brand colour becomes the store's primary: buttons, links and focus rings. */
function brandVars(theme: StoreTheme, mode: "light" | "dark"): Record<string, string> {
  const brand = theme.brand;
  if (!brand || !/^#[0-9a-f]{6}$/i.test(brand)) return {};
  // Dark mode needs a lighter brand to stay readable on dark surfaces
  const primary = mode === "dark" ? mixHex(brand, "#FFFFFF", 0.4) : brand;
  return {
    "--primary": primary,
    "--primary-hover": `color-mix(in oklab, ${primary} 86%, ${mode === "dark" ? "white" : "black"})`,
    "--primary-soft": mode === "dark" ? `color-mix(in oklab, ${primary} 22%, black)` : `color-mix(in oklab, ${primary} 12%, white)`,
    "--primary-foreground": readableOn(primary),
    "--ring": primary,
    "--chart-1": primary,
  };
}

/** The font pairing, with the store's own uploaded font in place of its headings and/or body when it has one. */
function fontsOf(theme: StoreTheme) {
  const pair = FONT_PAIRS.find((x) => x.id === theme.fonts) ?? FONT_PAIRS[0];
  const c = theme.customFont;
  if (!c || !fontFaceCss(c)) return pair;
  const own = `"${FONT_FAMILY}"`;
  return { ...pair, display: c.use === "body" ? pair.display : own, body: c.use === "headings" ? pair.body : own };
}

function paletteVars(theme: StoreTheme, mode: "light" | "dark"): Record<string, string> {
  const p = PALETTES.find((x) => x.id === theme.palette) ?? PALETTES[0];
  if (mode === "dark") return darkVars(theme, p);
  const f = fontsOf(theme);
  const accent = theme.accent || p.accent;
  // Utilities resolve to var(--font-bricolage)/var(--font-hanken); remap those (never to themselves).
  const fontRemap: Record<string, string> = {};
  if (f.display !== "var(--font-bricolage)") fontRemap["--font-bricolage"] = f.display;
  if (f.body !== "var(--font-hanken)") fontRemap["--font-hanken"] = f.body;
  return {
    ...fontRemap,
    "--background": p.background,
    "--surface-sunken": p.surfaceSunken,
    "--muted": p.muted,
    "--primary": p.primary,
    "--primary-hover": p.primaryHover,
    "--primary-soft": p.primarySoft,
    "--ring": p.primary,
    "--accent": accent,
    // A creator's own accent can be dark: keep text on it readable
    "--accent-foreground": /^#[0-9a-f]{6}$/i.test(accent) ? readableOn(accent) : "#0C1F1B",
    "--accent-strong": `color-mix(in oklab, ${accent} 82%, black)`,
    "--accent-ink": `color-mix(in oklab, ${accent} 52%, black)`,
    "--accent-soft": `color-mix(in oklab, ${accent} 14%, white)`,
    "--chart-1": p.primary,
    "--chart-2": accent,
    "--font-display": `${f.display}, ui-sans-serif, system-ui, sans-serif`,
    "--font-sans": `${f.body}, ui-sans-serif, system-ui, sans-serif`,
  };
}

function darkVars(theme: StoreTheme, p: Palette): Record<string, string> {
  const f = fontsOf(theme);
  const d = p.dark;
  const accent = theme.accent || p.accent;
  const hex = /^#[0-9a-f]{6}$/i.test(accent);
  const fontRemap: Record<string, string> = {};
  if (f.display !== "var(--font-bricolage)") fontRemap["--font-bricolage"] = f.display;
  if (f.body !== "var(--font-hanken)") fontRemap["--font-hanken"] = f.body;
  const soft = hex ? mixHex(accent, d.surface, 0.86) : d.muted;
  return {
    ...fontRemap,
    "--background": d.background,
    "--surface": d.surface,
    "--surface-sunken": d.surfaceSunken,
    "--muted": d.muted,
    "--primary": d.primary,
    "--primary-hover": d.primaryHover,
    "--primary-soft": d.primarySoft,
    "--primary-foreground": readableOn(d.primary),
    "--ring": d.primary,
    "--accent": accent,
    "--accent-foreground": hex ? readableOn(accent) : "#0C1F1B",
    "--accent-strong": hex ? mixHex(accent, "#FFFFFF", 0.15) : accent,
    // Brass-style small text: the accent, lightened until it reads on the dark surface and on
    // its own soft tint (badges and coupon stubs put it there)
    "--accent-ink": hex ? liftTo(liftTo(accent, d.surface), soft) : accent,
    "--accent-soft": soft,
    "--chart-1": d.primary,
    "--chart-2": accent,
    "--font-display": `${f.display}, ui-sans-serif, system-ui, sans-serif`,
    "--font-sans": `${f.body}, ui-sans-serif, system-ui, sans-serif`,
  };
}
