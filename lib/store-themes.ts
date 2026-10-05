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
}

export const PALETTES: Palette[] = [
  { id: "emerald", name: "Emerald", background: "#F5F6F4", surfaceSunken: "#EEF0EC", muted: "#EEF0EC", primary: "#0F3D33", primaryHover: "#14503F", primarySoft: "#E3ECE8", accent: "#C9A24F" },
  { id: "midnight", name: "Midnight", background: "#F4F5F8", surfaceSunken: "#ECEEF3", muted: "#ECEEF3", primary: "#1E2A4A", primaryHover: "#2A3961", primarySoft: "#E3E7F0", accent: "#D08C3A" },
  { id: "plum", name: "Plum", background: "#F7F4F6", surfaceSunken: "#F0EBEF", muted: "#F0EBEF", primary: "#4A2545", primaryHover: "#5E2F58", primarySoft: "#EEE3EC", accent: "#C98A6B" },
  { id: "terracotta", name: "Terracotta", background: "#F8F4F0", surfaceSunken: "#F1EBE4", muted: "#F1EBE4", primary: "#8A3B1E", primaryHover: "#A14725", primarySoft: "#F3E4DC", accent: "#3F7A66" },
  { id: "ocean", name: "Ocean", background: "#F2F6F7", surfaceSunken: "#E8EFF1", muted: "#E8EFF1", primary: "#0E4A5C", primaryHover: "#135C72", primarySoft: "#DFEBEF", accent: "#E0A43B" },
  { id: "graphite", name: "Graphite", background: "#F5F5F4", surfaceSunken: "#EDEDEB", muted: "#EDEDEB", primary: "#1F1F1F", primaryHover: "#363636", primarySoft: "#E8E8E6", accent: "#E8613F" },
];

export const FONT_PAIRS: { id: FontPairId; name: string; display: string; body: string; sample: string }[] = [
  { id: "modern", name: "Modern", display: "var(--font-bricolage)", body: "var(--font-hanken)", sample: "Bricolage Grotesque + Hanken Grotesk" },
  { id: "editorial", name: "Editorial", display: "var(--font-fraunces)", body: "var(--font-hanken)", sample: "Fraunces + Hanken Grotesk" },
  { id: "clean", name: "Clean", display: "var(--font-space)", body: "var(--font-plex-sans)", sample: "Space Grotesk + IBM Plex Sans" },
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
  about: { name: "About you", description: "Photo, story and social links." },
  faq: { name: "FAQ", description: "Questions you edit in Store › Pages." },
  newsletter: { name: "Newsletter", description: "Collect emails from visitors." },
};

export const DEFAULT_SECTIONS: SectionId[] = ["announcement", "hero", "highlights", "collections", "bestsellers", "new", "offers", "reviews", "about", "faq", "newsletter"];

/** CSS variables a theme sets on the store's root element. */
export function themeVars(theme: StoreTheme): Record<string, string> {
  const p = PALETTES.find((x) => x.id === theme.palette) ?? PALETTES[0];
  const f = FONT_PAIRS.find((x) => x.id === theme.fonts) ?? FONT_PAIRS[0];
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
    "--accent-strong": `color-mix(in oklab, ${accent} 82%, black)`,
    "--accent-ink": `color-mix(in oklab, ${accent} 52%, black)`,
    "--accent-soft": `color-mix(in oklab, ${accent} 14%, white)`,
    "--chart-1": p.primary,
    "--chart-2": accent,
    "--font-display": `${f.display}, ui-sans-serif, system-ui, sans-serif`,
    "--font-sans": `${f.body}, ui-sans-serif, system-ui, sans-serif`,
  };
}
