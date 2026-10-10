import type { Focal, MediaRef, TileBackground } from "./media";
import type { ISODate, Money } from "./money";

export type ProductStatus = "published" | "draft" | "archived";
export type ProductKind = "ebook" | "template" | "preset" | "notion" | "course" | "audio" | "other";

export type CoverTemplate = "block" | "split" | "frame" | "stack" | "badge" | "grid";

export interface CoverSpec {
  template: CoverTemplate;
  title: string;
  subtitle?: string;
  bg: string;
  fg: string;
  accent: string;
}

export interface ProductImage {
  id: string;
  alt: string;
  /** An uploaded image ("asset:<id>") or a remote https URL */
  src?: string;
  /** Or a generated cover. */
  cover?: CoverSpec;
  /** Where to keep in frame when the image is cropped */
  focal?: Focal;
}

export interface ProductFile {
  id: string;
  name: string;
  /** Bytes */
  size: number;
  mime: string;
  /** Where the file sits in private storage (`<store id>/…`). Set once uploaded to the backend. */
  path?: string;
}

/** A choice buyers make, like Size: S, M, L. Up to 3 per product. */
export interface ProductOption {
  name: string;
  values: string[];
}

/** One combination of a physical product's options, with its own price, SKU and stock */
export interface ProductVariant {
  id: string;
  /** "M / Blue" */
  title: string;
  /** The value for each option, in the product's option order */
  options: string[];
  sku: string;
  price: Money;
  compareAt?: Money;
  /** Units left, when the product counts stock */
  stock?: number;
  /** A picture for this variant (https) */
  image?: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: ProductKind;
  /** What buyers get: a download, or something shipped to them. Chosen first, and fixed once saved. */
  fulfilment: "digital" | "physical";
  price: Money;
  compareAt?: Money;
  /** Lowest price deal paths may discount this product to. None = no floor. */
  priceFloor?: Money;
  /** Up to 8. The first one is the cover. */
  images: ProductImage[];
  /** One optional video, shown in the product gallery after the images */
  video?: MediaRef;
  /** Colour or image for cards when the product has no images */
  tileBackground?: TileBackground;
  files: ProductFile[];
  sku: string;
  taxCode: string;
  /** GST rate in percent for the tax code (a custom code carries its own) */
  taxRate?: number;
  status: ProductStatus;
  sourceUrl?: string;
  pageId?: string;
  /** Physical products: the choices (Size, Colour) and one variant per combination */
  options?: ProductOption[];
  variants?: ProductVariant[];
  /** Physical products: count stock and stop selling at zero */
  trackStock?: boolean;
  /** Units left when the product has no variants and counts stock */
  stock?: number;
  weightGrams?: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Denormalized for lists */
  salesCount: number;
  revenue: Money;
}

export type ProductInput = Pick<
  Product,
  "title" | "description" | "kind" | "fulfilment" | "price" | "images" | "files" | "sku" | "taxCode" | "status" | "video" | "tileBackground"
> & { sourceUrl?: string; compareAt?: Money; taxRate?: number; options?: ProductOption[]; variants?: ProductVariant[]; trackStock?: boolean; stock?: number; weightGrams?: number };

export interface LinkAutofill {
  url: string;
  sourceName: string;
  title: string;
  description: string;
  price: Money;
  images: ProductImage[];
  kind: ProductKind;
}
