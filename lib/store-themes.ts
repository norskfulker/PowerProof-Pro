import { layoutVars } from "./site-styles";
import { contrast, liftTo, mixHex, readableOn } from "./color";
import { FONT_FAMILY, fontFaceCss } from "./fonts";
import type { ColorScheme, FontPairId, HeroStyle, PaletteId, SchemeColors, SectionContent, SectionId, SectionKind, SectionSetting, StoreTheme } from "./types";

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

export const SECTION_META: Record<SectionKind, { name: string; description: string; /** Can be added more than once */ multiple: boolean }> = {
  announcement: { name: "Announcement bar", description: "Offer text, a code and an optional countdown.", multiple: false },
  hero: { name: "Hero", description: "Headline, up to two buttons and your best images.", multiple: true },
  highlights: { name: "Highlights strip", description: "Instant download, secure payment, rating, sales. Or your own points.", multiple: true },
  collections: { name: "Collections", description: "Tiles that open filtered product lists.", multiple: false },
  bestsellers: { name: "Bestsellers", description: "Your most bought products.", multiple: true },
  new: { name: "New arrivals", description: "Latest products first.", multiple: true },
  offers: { name: "Offers", description: "Coupons, bundles and the live deal.", multiple: false },
  reviews: { name: "Reviews wall", description: "Top verified reviews and your average.", multiple: false },
  html: { name: "Custom HTML", description: "A section made from an HTML file you upload.", multiple: false },
  about: { name: "About you", description: "Photo, story and social links.", multiple: false },
  faq: { name: "FAQ", description: "Questions you edit in Store › Pages.", multiple: false },
  newsletter: { name: "Newsletter", description: "Collect emails from visitors.", multiple: false },
  text: { name: "Text and button", description: "A heading, a few lines and a button.", multiple: true },
  columns: { name: "Columns", description: "Two to four side-by-side points, each with an optional link.", multiple: true },
  table: { name: "Table", description: "Rows and columns: comparisons, specs, what's included.", multiple: true },
  marquee: { name: "Scrolling strip", description: "A moving line of text or logos.", multiple: true },
  image: { name: "Image", description: "One picture or GIF, uploaded straight onto the page.", multiple: true },
  video: { name: "Video", description: "An uploaded video, or a YouTube or Vimeo link.", multiple: true },
};

export const DEFAULT_SECTIONS: SectionId[] = ["announcement", "hero", "highlights", "collections", "bestsellers", "new", "offers", "reviews", "html", "about", "faq", "newsletter"];

/** The order sections are offered in "Add section" */
export const ADDABLE_KINDS: SectionKind[] = ["hero", "text", "image", "video", "columns", "table", "marquee", "highlights", "bestsellers", "new", "collections", "offers", "reviews", "faq", "about", "newsletter", "html"];

/** Sections whose content can sit left, centre or right */
export const ALIGNABLE = new Set<SectionKind>(["hero", "text", "columns", "image"]);

export const kindOf = (s: Pick<SectionSetting, "id" | "kind">): SectionKind => s.kind ?? (s.id as SectionKind);

/** What a new section of this kind starts with. The creator edits it straight away. */
export function startContent(kind: SectionKind): SectionContent | undefined {
  switch (kind) {
    case "hero":
      return { hero: { headline: "A new headline", subtext: "", ctaLabel: "Shop now", ctaTarget: "products", imageProductIds: [] } };
    case "text":
      return { text: { heading: "A short heading", body: "Say a little about this part of your store.", ctaLabel: "", ctaTarget: "products" } };
    case "columns":
      return { columns: [1, 2, 3].map((n) => ({ title: `Point ${n}`, body: "One or two lines." })) };
    case "table":
      return { table: { rows: [["", "Basic", "Pro"], ["Feature", "Yes", "Yes"]], header: true, striped: true } };
    case "marquee":
      return { marquee: { mode: "text", items: [{ text: "Instant download" }, { text: "Secure payment" }, { text: "Made in India" }], speed: "normal", direction: "left", pauseOnHover: true } };
    case "image":
      return { image: { src: "", alt: "", aspect: "16:9", fit: "cover" } };
    case "video":
      return { video: { src: "" } };
    case "bestsellers":
    case "new":
      return { count: 4 };
    default:
      return undefined;
  }
}

/** An id no other section has, so the same kind can sit on the page many times */
export const newSectionId = (kind: SectionKind): string => `${kind}-${Math.random().toString(36).slice(2, 7)}`;

/** A fresh section with its own id, so the same kind can sit on the page many times. */
export function makeSection(kind: SectionKind, id: string): SectionSetting {
  // Custom HTML has nothing to show until a file is uploaded
  return { id, kind, enabled: kind !== "html", content: startContent(kind) };
}

/**
 * Where a button or link goes. Accepts the store's own things (products, a collection, a product,
 * a store page, a section on this page) and https links. Anything else falls back to all products.
 */
export function targetHref(slug: string, target: string | undefined): string {
  const t = target ?? "products";
  if (t.startsWith("collection:")) return `/s/${slug}/c/${t.slice(11)}`;
  if (t.startsWith("product:")) return `/s/${slug}/${t.slice(8)}`;
  if (t.startsWith("page:")) return `/s/${slug}/${t.slice(5)}`;
  if (t.startsWith("section:")) return `#section-${t.slice(8)}`;
  if (t.startsWith("url:")) return /^(https:\/\/|mailto:)/i.test(t.slice(4)) ? t.slice(4) : `/s/${slug}/products`;
  return `/s/${slug}/products`;
}

/** Which theme a store shows: the buyer's own choice, else the creator's default, else the site's. */
export function resolveStoreMode(theme: StoreTheme, siteMode: "light" | "dark", buyer?: "light" | "dark"): "light" | "dark" {
  if (buyer) return buyer;
  const m = theme.mode ?? "auto";
  return m === "auto" ? siteMode : m;
}

/** CSS variables a theme sets on the store's root element, in light or dark. */
export function themeVars(theme: StoreTheme, mode: "light" | "dark" = "light"): Record<string, string> {
  return { ...paletteVars(theme, mode), ...brandVars(theme, mode), ...CORNERS[theme.corners ?? "soft"], ...layoutVars(theme) };
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

/** "Hero", then "Hero 2" for the next one, so two sections of a kind can be told apart */
export function sectionNames(sections: SectionSetting[]): Record<string, string> {
  const seen: Record<string, number> = {};
  return Object.fromEntries(
    sections.map((s) => {
      const kind = kindOf(s);
      seen[kind] = (seen[kind] ?? 0) + 1;
      const base = SECTION_META[kind].name;
      return [s.id, seen[kind] > 1 ? `${base} ${seen[kind]}` : base];
    })
  );
}

/* Colour schemes ------------------------------------------------------------ */

const INK = "#0C1F1B";
const PORCELAIN = "#F5F6F4";

/** The store's primary colour in a mode: its brand colour when it has one, else the palette's */
function primaryOf(theme: StoreTheme, p: Palette, mode: "light" | "dark"): string {
  const brand = theme.brand && /^#[0-9a-f]{6}$/i.test(theme.brand) ? theme.brand : undefined;
  if (mode === "dark") return brand ? mixHex(brand, "#FFFFFF", 0.4) : p.dark.primary;
  return brand ?? p.primary;
}

function colors(background: string, button: string, text = readableOn(background), border = mixHex(background, text, 0.14)): SchemeColors {
  return { background, text, button, buttonText: readableOn(button), border };
}

/** The five schemes every store starts with, made from its palette and brand colour */
export function defaultSchemes(theme: StoreTheme): ColorScheme[] {
  const p = PALETTES.find((x) => x.id === theme.palette) ?? PALETTES[0];
  const accent = theme.accent && /^#[0-9a-f]{6}$/i.test(theme.accent) ? theme.accent : p.accent;
  const lp = primaryOf(theme, p, "light");
  const dp = primaryOf(theme, p, "dark");
  return [
    { id: "scheme-1", name: "Page", light: colors(p.background, lp, INK), dark: colors(p.dark.background, dp, "#EAF0ED") },
    { id: "scheme-2", name: "Card", light: colors("#FFFFFF", lp, INK), dark: colors(p.dark.surface, dp, "#EAF0ED") },
    { id: "scheme-3", name: "Tinted", light: colors(mixHex(lp, "#FFFFFF", 0.88), lp, INK), dark: colors(mixHex(dp, "#000000", 0.78), dp, "#EAF0ED") },
    { id: "scheme-4", name: "Brand", light: colors(lp, accent), dark: colors(mixHex(dp, "#000000", 0.45), accent) },
    { id: "scheme-5", name: "Ink", light: colors(INK, accent, PORCELAIN), dark: colors("#050B0A", accent, PORCELAIN) },
  ];
}

/** The store's schemes: its own when it has edited them, else the defaults */
export function schemesOf(theme: StoreTheme): ColorScheme[] {
  return theme.schemes?.length ? theme.schemes : defaultSchemes(theme);
}

/** An id for a new scheme that no other scheme has */
export function newSchemeId(schemes: ColorScheme[]): string {
  let n = schemes.length + 1;
  while (schemes.some((s) => s.id === `scheme-${n}`)) n++;
  return `scheme-${n}`;
}

/**
 * The tokens a scheme sets on a section, so everything inside it (text, cards, buttons, inputs,
 * tables) takes its colours without knowing about schemes.
 */
export function schemeVars(c: SchemeColors): Record<string, string> {
  const soft = mixHex(c.button, c.background, 0.86);
  return {
    "--background": c.background,
    "--surface": mixHex(c.background, c.text, 0.03),
    "--surface-sunken": mixHex(c.background, c.text, 0.06),
    "--muted": mixHex(c.background, c.text, 0.07),
    "--foreground": c.text,
    "--muted-foreground": liftTo(mixHex(c.text, c.background, 0.32), c.background),
    "--border": c.border,
    "--border-strong": mixHex(c.border, c.text, 0.25),
    "--input": c.border,
    "--primary": c.button,
    "--primary-hover": mixHex(c.button, c.text, 0.14),
    "--primary-foreground": c.buttonText,
    "--primary-soft": soft,
    "--ring": c.button,
    background: c.background,
    color: c.text,
  };
}

/** Where a scheme's text or button may be hard to read, in plain words */
export function schemeWarnings(c: SchemeColors): string[] {
  const out: string[] = [];
  if (contrast(c.text, c.background) < 4.5) out.push(`Text on the background is ${contrast(c.text, c.background).toFixed(1)}:1. Aim for 4.5:1.`);
  if (contrast(c.buttonText, c.button) < 4.5) out.push(`Button label on the button is ${contrast(c.buttonText, c.button).toFixed(1)}:1. Aim for 4.5:1.`);
  return out;
}

/** Class a block or the header carries to take a scheme's colours */
export const schemeClass = (id: string | undefined): string | undefined => (id && /^[\w-]{1,40}$/.test(id) ? `pp-scheme-${id}` : undefined);

/**
 * CSS for every scheme, in light and dark. The store's theme scope carries data-store-mode (not
 * data-theme, which the app's own root also has), so a section
 * picks the right colours however the mode was chosen (creator default, buyer switch, device).
 */
export function schemeCss(theme: StoreTheme): string {
  const decl = (c: SchemeColors) =>
    Object.entries(schemeVars(c))
      .map(([k, v]) => (k === "background" ? `background-color:${v}` : `${k}:${v}`))
      .join(";");
  return schemesOf(theme)
    .filter((s) => schemeClass(s.id))
    .map((s) => `[data-store-mode="light"] .${schemeClass(s.id)}{${decl(s.light)}}[data-store-mode="dark"] .${schemeClass(s.id)}{${decl(s.dark)}}`)
    .join("");
}
