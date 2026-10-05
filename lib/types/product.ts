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
  /** A real image URL (object URL or remote). */
  src?: string;
  /** Or a generated cover. */
  cover?: CoverSpec;
}

export interface ProductFile {
  id: string;
  name: string;
  /** Bytes */
  size: number;
  mime: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: ProductKind;
  price: Money;
  compareAt?: Money;
  images: ProductImage[];
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
  "title" | "description" | "kind" | "price" | "images" | "files" | "sku" | "taxCode" | "status"
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
