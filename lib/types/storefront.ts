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
  | "about"
  | "faq"
  | "newsletter";

export interface SectionSetting {
  id: SectionId;
  enabled: boolean;
}

export type PaletteId = "emerald" | "midnight" | "plum" | "terracotta" | "ocean" | "graphite";
export type FontPairId = "modern" | "editorial" | "clean";
export type HeroStyle = "left" | "centered" | "full";

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
  /** Buttons and corners, in three steps */
  corners?: "sharp" | "soft" | "round";
}

export interface HeroContent {
  headline: string;
  subtext: string;
  ctaLabel: string;
  /** "products", "collection:<slug>" or "product:<slug>" */
  ctaTarget: string;
  /** Product ids whose covers make the image or collage. */
  imageProductIds: string[];
  videoUrl?: string;
  /** Uploaded image, GIF or looping video behind the hero. Phones and reduced motion get the poster. */
  background?: TileBackground;
}

export interface Announcement {
  text: string;
  code?: string;
  endsAt?: ISODate;
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

export interface StoreDesign {
  sections: SectionSetting[];
  theme: StoreTheme;
  hero: HeroContent;
  announcement: Announcement;
  about: AboutContent;
  socials: SocialLinks;
  seo: { title: string; description: string };
  newsletter: { heading: string; body: string };
  /** Optional add-on offered at checkout */
  orderBump?: { productId: string; price: Money; label: string };
  showPoweredBy: boolean;
  customDomain?: string;
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
