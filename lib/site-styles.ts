import type { FontPairId, SiteLayout, SiteStyleId, StoreTheme } from "./types";
import type { PageDoc, PageNode } from "./pages/schema";

/**
 * Site templates: the store picks one type of site, and every page follows it. A type sets the
 * whole layout (content width, spacing, heading scale, dividers, header and footer) and the type's
 * finishing touches (heading style, corners, fonts). The creator can then change any part of the
 * layout; the choice stays store-wide, so all pages always look like one site.
 */
export interface SiteStyleDef {
  id: SiteStyleId;
  name: string;
  /** One line, in the picker */
  description: string;
  /** What it suits, in the picker */
  goodFor: string;
  layout: Required<SiteLayout>;
  corners: NonNullable<StoreTheme["corners"]>;
  fonts: FontPairId;
  headerAlign: "left" | "center";
}

export const SITE_STYLES: SiteStyleDef[] = [
  {
    id: "blocks",
    name: "Blockwise",
    description: "Clear, stacked sections with tidy product grids, like a Shopify store.",
    goodFor: "Shops with many products",
    layout: { width: "standard", spacing: "comfortable", headings: "medium", dividers: true, footer: "columns" },
    corners: "soft",
    fonts: "clean",
    headerAlign: "left",
  },
  {
    id: "freeflow",
    name: "Freeflow",
    description: "Big type, full-width bands and lots of air, like a modern agency site.",
    goodFor: "Brands, studios and launches",
    layout: { width: "full", spacing: "airy", headings: "huge", dividers: false, footer: "minimal" },
    corners: "sharp",
    fonts: "modern",
    headerAlign: "left",
  },
  {
    id: "informational",
    name: "Informational",
    description: "A calm reading column with modest headings, like a help centre or guide.",
    goodFor: "Courses, guides and services",
    layout: { width: "narrow", spacing: "compact", headings: "small", dividers: true, footer: "columns" },
    corners: "soft",
    fonts: "clean",
    headerAlign: "left",
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Magazine-style headlines and generous margins, made for reading.",
    goodFor: "Writers, blogs and newsletters",
    layout: { width: "standard", spacing: "airy", headings: "large", dividers: false, footer: "centered" },
    corners: "sharp",
    fonts: "editorial",
    headerAlign: "center",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Quiet, centred and spare. The product does the talking.",
    goodFor: "One product or a portfolio",
    layout: { width: "narrow", spacing: "airy", headings: "medium", dividers: false, footer: "minimal" },
    corners: "soft",
    fonts: "modern",
    headerAlign: "center",
  },
  {
    id: "bold",
    name: "Bold",
    description: "Loud headlines, rounded buttons and strong colour blocks.",
    goodFor: "Sales, drops and creators",
    layout: { width: "wide", spacing: "comfortable", headings: "large", dividers: false, footer: "columns" },
    corners: "round",
    fonts: "modern",
    headerAlign: "left",
  },
];

export const DEFAULT_STYLE: SiteStyleId = "blocks";

export const styleById = (id: SiteStyleId | undefined): SiteStyleDef => SITE_STYLES.find((s) => s.id === id) ?? SITE_STYLES[0];

/** The layout in force: the type's own, with the creator's changes on top */
export function layoutOf(theme: Pick<StoreTheme, "siteStyle" | "layout">): Required<SiteLayout> {
  return { ...styleById(theme.siteStyle).layout, ...stripUndefined(theme.layout ?? {}) };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const SPACE = { compact: 0.7, comfortable: 1, airy: 1.4 } as const;
const MEASURE = { narrow: 0.8, standard: 1, wide: 1.25, full: 1.6 } as const;
const DISPLAY = { small: 0.85, medium: 1, large: 1.2, huge: 1.45 } as const;

/** CSS variables the renderer's scales read (padding, content width, heading size) */
export function layoutVars(theme: Pick<StoreTheme, "siteStyle" | "layout">): Record<string, string> {
  const l = layoutOf(theme);
  return { "--pp-space": String(SPACE[l.spacing]), "--pp-measure": String(MEASURE[l.width]), "--pp-display": String(DISPLAY[l.headings]) };
}

/** The type's finishing touches, scoped to the store root ([data-site-style]) */
export function siteStyleCss(theme: Pick<StoreTheme, "siteStyle" | "layout">): string {
  const style = styleById(theme.siteStyle).id;
  const l = layoutOf(theme);
  const root = `[data-site-style="${style}"]`;
  const sections = `${root} section[id^="section-"]`;
  const rules: string[] = [];
  // A thin line between stacked sections
  if (l.dividers) rules.push(`${sections}+section[id^="section-"]{border-top:1px solid color-mix(in oklab, currentColor 12%, transparent)}`);
  if (style === "freeflow") rules.push(`${root} :is(h1,h2){letter-spacing:-0.045em;line-height:0.98}`, `${sections}{text-align:left}`);
  if (style === "editorial") rules.push(`${root} :is(h1,h2,h3){letter-spacing:-0.01em;font-weight:700}`, `${root} p{line-height:1.7}`);
  if (style === "informational") rules.push(`${root} :is(h1,h2,h3){letter-spacing:-0.01em}`, `${root} p{line-height:1.65}`);
  if (style === "bold") rules.push(`${root} :is(h1,h2){text-transform:uppercase;letter-spacing:-0.01em}`);
  if (style === "minimal") rules.push(`${root} :is(h1,h2,h3){font-weight:600;letter-spacing:-0.01em}`);
  return rules.join("");
}

/**
 * Re-lays a page out for a site type: section widths, spacing and alignment the type would use.
 * Applied to every new page, and to the page being edited when the type changes (one undo step),
 * so templates and the site's look always agree. Colours, text and blocks are never touched.
 */
export function styleDoc(doc: PageDoc, id: SiteStyleId | undefined): PageDoc {
  const style = styleById(id).id;
  const top = (n: PageNode, i: number): PageNode => {
    if (n.type !== "section" && n.type !== "hero") return n;
    const layout = { ...n.layout };
    const align = (a: "left" | "center") => ({ ...n.style, align: a });
    switch (style) {
      case "freeflow":
        return { ...n, layout: { ...layout, width: "full", paddingY: i === 0 ? "xl" : "lg", fill: "full" }, style: align("left") };
      case "informational":
        return { ...n, layout: { ...layout, width: "narrow", paddingY: "md", minHeight: "auto" }, style: align("left") };
      case "editorial":
        return { ...n, layout: { ...layout, width: i === 0 ? "wide" : "normal", paddingY: "lg" }, style: align(i === 0 ? "center" : "left") };
      case "minimal":
        return { ...n, layout: { ...layout, width: "narrow", paddingY: "lg" }, style: align("center") };
      case "bold":
        return { ...n, layout: { ...layout, width: "wide", paddingY: i === 0 ? "xl" : "lg", fill: i === 0 ? "full" : "content" } };
      default:
        return { ...n, layout: { ...layout, width: layout.width === "full" ? "wide" : layout.width, paddingY: "md" } };
    }
  };
  return { ...doc, blocks: doc.blocks.map(top) };
}
