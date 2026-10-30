import type { ISODate } from "./money";

export type MediaKind = "image" | "gif" | "video";

/** A file in the media library */
export interface MediaItem {
  id: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  /** "asset:<id>" for files kept in this browser, or an https URL */
  src: string;
  alt: string;
  source: "upload" | "ai";
  createdAt: ISODate;
  /** AI images: the prompt that made it */
  prompt?: string;
}

/** A focal point in percent, used to crop images and video in any frame */
export interface Focal {
  x: number;
  y: number;
}

/** What a picked image or video looks like wherever it's used */
export interface MediaRef {
  src: string;
  alt: string;
  focal?: Focal;
  /** Video only */
  poster?: string;
  kind?: MediaKind;
}

/**
 * Tile and section backgrounds (Part 6B): a colour, or an image (or video, for heroes),
 * with an optional dark overlay to keep text readable.
 */
export type TileBackground =
  | { kind: "color"; color: string; overlay?: number }
  | { kind: "image"; src: string; alt: string; focal: Focal; overlay?: number }
  | { kind: "video"; src: string; poster: string; focal: Focal; overlay?: number };

export type AiPurpose = "product_cover" | "hero_banner" | "social_post" | "collection_tile";
