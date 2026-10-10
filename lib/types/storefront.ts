import type { ISODate, Money } from "./money";
import type { MediaRef, TileBackground } from "./media";
import type { CoverSpec, ProductImage } from "./product";

/* ---------------------------------------------------------------- */
/* Store design                                                      */
/* ---------------------------------------------------------------- */

export type SectionId =
  | "announcement"
  | "hero"
  | "highlights"
  | "collections"
  | "bestsellers"
  | "new"
  | "offers"
  | "reviews"
  | "html"
  | "about"
  | "faq"
  | "newsletter";

/** Sections the creator can add any number of times. Their content lives on the section itself. */
export type ExtraSectionKind = "text" | "columns" | "table" | "marquee" | "image" | "video";
export type SectionKind = SectionId | ExtraSectionKind;

export type Align = "left" | "center" | "right";

/** Where a button or link goes: "products", "collection:<slug>", "product:<slug>", "page:<faq|about|contact>", "url:https://…" or "section:<id>" */
export type LinkTarget = string;

/** The same quick controls on every section */
export interface SectionLayout {
  align?: Align;
  width?: "narrow" | "normal" | "wide" | "full";
  space?: "none" | "sm" | "md" | "lg";
  /** A tinted or outlined panel behind the section */
  tone?: "none" | "soft" | "outline";
  /** Hide on one kind of screen */
  hideOn?: "mobile" | "desktop";
}

export interface HighlightItem {
  icon: "download" | "shield" | "refund" | "star" | "zap" | "heart" | "globe" | "check";
  title: string;
  body: string;
}

export interface MarqueeItem {
  text?: string;
  /** A logo image (https) */
  src?: string;
  alt?: string;
  href?: LinkTarget;
}

export interface SectionContent {
  /** A hero added after the first one (the first uses design.hero) */
  hero?: HeroContent;
  /** Replaces the automatic items of the highlights strip */
  highlights?: HighlightItem[];
  text?: { heading: string; body: string; ctaLabel?: string; ctaTarget?: LinkTarget };
  columns?: { title: string; body: string; ctaLabel?: string; ctaTarget?: LinkTarget }[];
  table?: { rows: string[][]; header: boolean; striped: boolean };
  marquee?: { mode: "text" | "logos"; items: MarqueeItem[]; speed: "slow" | "normal" | "fast"; direction: "left" | "right"; pauseOnHover: boolean };
  /** A picture uploaded to the media library (empty until one is added) */
  image?: { src: string; alt: string; aspect: "16:9" | "4:3" | "1:1" | "3:1"; fit: "cover" | "contain"; kind?: "image" | "gif"; caption?: string; href?: LinkTarget };
  /** An uploaded video, or a YouTube or Vimeo link */
  video?: { src: string; poster?: string; url?: string; caption?: string };
  /** Products shown by bestsellers / new arrivals */
  count?: number;
}

export interface SectionSetting {
  /** Unique on the page. Sections made before this was added use their kind as the id. */
  id: string;
  /** What it shows. Defaults to the id. */
  kind?: SectionKind;
  enabled: boolean;
  /** Heading above the section, for kinds that show one */
  title?: string;
  layout?: SectionLayout;
  content?: SectionContent;
}

/** The store header: the bar above the menu, and the menu itself */
export interface HeaderSettings {
  align?: "left" | "center";
  sticky?: boolean;
  search?: boolean;
  /** Your own menu links. Empty uses All products, your collections and Contact. */
  links?: { label: string; target: LinkTarget }[];
  /** A colour scheme from the theme (its id); empty keeps the store's own look */
  scheme?: string;
}

export interface FooterSettings {
  /** A colour scheme from the theme (its id) */
  scheme?: string;
}

export type PaletteId = "emerald" | "midnight" | "plum" | "terracotta" | "ocean" | "graphite";
export type FontPairId = "modern" | "editorial" | "clean";
export type HeroStyle = "left" | "centered" | "full";

/** The store's own font file, uploaded to its media folder */
export interface CustomFont {
  /** Shown in the editor */
  name: string;
  src: string;
  format: "woff2" | "woff" | "truetype" | "opentype";
  /** Where it is used; everything else keeps the chosen font pairing */
  use: "both" | "headings" | "body";
}

export interface StoreTheme {
  palette: PaletteId;
  /** Hex. Overrides the palette's accent. */
  accent?: string;
  fonts: FontPairId;
  heroStyle: HeroStyle;
  /** The store's default look (Part 7A). Auto follows the visitor's device. Buyers can switch. */
  mode?: "light" | "dark" | "auto";
  /** The brand colour (stores.brand_color), mirrored here so the storefront can paint with it. The column wins. */
  brand?: string;
  /** The store's own uploaded font. Overrides the chosen pairing where it applies. */
  customFont?: CustomFont;
  /** Buttons and corners, in three steps */
  corners?: "sharp" | "soft" | "round";
  /** Named colour schemes sections pick from. Empty uses the five made from the palette. */
  schemes?: ColorScheme[];
}

/** The colours of one scheme in one mode. All hex. */
export interface SchemeColors {
  background: string;
  text: string;
  /** Solid buttons and links */
  button: string;
  buttonText: string;
  /** Lines around cards, inputs and tables */
  border: string;
}

/** A colour scheme (like Shopify's): a section picks one by id, and it applies in light and dark */
export interface ColorScheme {
  id: string;
  name: string;
  light: SchemeColors;
  dark: SchemeColors;
}

export interface HeroContent {
  headline: string;
  subtext: string;
  ctaLabel: string;
  /** "products", "collection:<slug>" or "product:<slug>" */
  ctaTarget: LinkTarget;
  /** Product ids whose covers make the image or collage. */
  imageProductIds: string[];
  videoUrl?: string;
  /** Uploaded image, GIF or looping video behind the hero. Phones and reduced motion get the poster. */
  background?: TileBackground;
  /** Second button, next to the first */
  cta2Label?: string;
  cta2Target?: LinkTarget;
}

export interface Announcement {
  text: string;
  code?: string;
  endsAt?: ISODate;
  align?: Align;
  tone?: "brand" | "dark" | "soft";
  /** Scroll the message across the bar */
  scroll?: boolean;
  /** Makes the message a link */
  target?: LinkTarget;
}

export interface SocialLinks {
  instagram?: string;
  youtube?: string;
  x?: string;
  website?: string;
}

export interface AboutContent {
  name: string;
  initials: string;
  story: string;
  location: string;
  photo?: MediaRef;
}

/** A section built from an HTML file the creator uploaded. Shown in a sandboxed frame. */
export interface HtmlSectionContent {
  /** The file name, for the editor */
  name: string;
  source: string;
  /** Pixels, when the page can't tell its own height */
  height?: number;
}

export interface StoreDesign {
  sections: SectionSetting[];
  header?: HeaderSettings;
  footer?: FooterSettings;
  theme: StoreTheme;
  hero: HeroContent;
  announcement: Announcement;
  about: AboutContent;
  socials: SocialLinks;
  seo: { title: string; description: string };
  newsletter: { heading: string; body: string };
  /** The uploaded HTML for the "Custom HTML" section */
  html?: HtmlSectionContent;
  /** Optional add-on offered at checkout */
  orderBump?: { productId: string; price: Money; label: string };
  showPoweredBy: boolean;
  customDomain?: string;
  /** Analytics tags added to every page of this store (after the visitor agrees) */
  analytics?: AnalyticsTags;
}

export interface AnalyticsTags {
  /** Google Analytics 4 measurement ID, like G-ABC123XYZ */
  ga4Id?: string;
  /** Microsoft Clarity project ID */
  clarityId?: string;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export type StorePageKey = "about" | "faq" | "refund" | "terms" | "privacy";

/** Each store's own About, FAQ and policies. Nothing is shared between stores. */
export interface StorePages {
  faq: FaqItem[];
  refund: string;
  terms: string;
  privacy: string;
  contactNote: string;
  /** Which pages the creator has changed from the default text ("Not edited yet" until then) */
  edited?: Partial<Record<StorePageKey, boolean>>;
}

/* ---------------------------------------------------------------- */
/* Catalogue                                                         */
/* ---------------------------------------------------------------- */

export interface Collection {
  id: string;
  slug: string;
  name: string;
  productIds: string[];
  cover: CoverSpec;
  /** Tile colour or image chosen by the creator; the cover is the fallback */
  background?: TileBackground;
}

export interface Coupon {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  /** Percent (1–90) or minor units for fixed */
  value: number;
  expiresAt?: ISODate;
  usageLimit?: number;
  used: number;
  scope: "store" | "products";
  productIds: string[];
  minSpend?: Money;
  active: boolean;
}

export interface Bundle {
  id: string;
  name: string;
  productIds: string[];
  pricing: { kind: "price"; price: Money } | { kind: "percent"; percent: number };
  active: boolean;
}

export interface Deal {
  id: string;
  name: string;
  /** Empty means every product */
  productIds: string[];
  percentOff: number;
  startsAt: ISODate;
  endsAt: ISODate;
}

/* ---------------------------------------------------------------- */
/* Social proof                                                      */
/* ---------------------------------------------------------------- */

export interface Review {
  id: string;
  productId: string;
  orderId?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  /** Up to 3 */
  photos: ProductImage[];
  /** "Asha K." */
  author: string;
  createdAt: ISODate;
  helpful: number;
  verified: boolean;
  imported: boolean;
  reply?: { body: string; createdAt: ISODate };
  pinned: boolean;
  hidden: boolean;
  reported: boolean;
}

export interface Answer {
  id: string;
  author: string;
  role: "creator" | "buyer";
  body: string;
  createdAt: ISODate;
}

export interface Question {
  id: string;
  productId: string;
  /** First name only */
  asker: string;
  askerEmail: string;
  body: string;
  createdAt: ISODate;
  answers: Answer[];
  hidden: boolean;
  reported: boolean;
}

export interface RatingSummary {
  average: number;
  count: number;
  /** index 0 = 1 star … index 4 = 5 stars */
  bars: [number, number, number, number, number];
}

export type ReviewSort = "newest" | "highest" | "lowest" | "helpful";
export type ProductSort = "popular" | "newest" | "price-asc" | "price-desc" | "rating";

/** Effective price after any live deal. */
export interface PriceInfo {
  price: Money;
  compareAt?: Money;
  percentOff?: number;
  dealEndsAt?: ISODate;
}
