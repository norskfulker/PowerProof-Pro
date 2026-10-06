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

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: ProductKind;
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
  status: ProductStatus;
  sourceUrl?: string;
  pageId?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Denormalized for lists */
  salesCount: number;
  revenue: Money;
}

export type ProductInput = Pick<
  Product,
  "title" | "description" | "kind" | "price" | "images" | "files" | "sku" | "taxCode" | "status" | "video" | "tileBackground"
> & { sourceUrl?: string; compareAt?: Money };

export interface LinkAutofill {
  url: string;
  sourceName: string;
  title: string;
  description: string;
  price: Money;
  images: ProductImage[];
  kind: ProductKind;
}
