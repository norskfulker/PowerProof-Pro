import type { ISODate } from "./money";

export type MediaKind = "image" | "gif" | "video";

/** A file in the media library: uploaded by the creator or made with the AI image maker. */
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
export type AiAspect = "1:1" | "4:5" | "16:9" | "3:1";
export type AiStyle = "clean" | "bold" | "playful" | "minimal" | "photographic" | "illustration";

export interface AiRequest {
  prompt: string;
  purpose: AiPurpose;
  aspect: AiAspect;
  style: AiStyle;
  /** Reference image (asset or URL) */
  reference?: string;
  /** Hex colours to lean on */
  brandColors?: string[];
}

export interface AiTextLayer {
  text: string;
  /** Percent position of the text block's centre */
  x: number;
  y: number;
  size: "sm" | "md" | "lg";
  color: string;
  font: "display" | "body";
}

export interface AiImage {
  id: string;
  src: string;
  width: number;
  height: number;
  /** How this one was made, for the history panel */
  op: "generate" | "regenerate" | "vary" | "edit" | "remove_bg" | "replace_bg" | "upscale";
  instruction?: string;
  seed: number;
  reported?: boolean;
}

export interface AiGeneration {
  id: string;
  at: ISODate;
  request: AiRequest;
  images: AiImage[];
}

export interface AiCredits {
  /** Calendar month, YYYY-MM */
  month: string;
  used: number;
  limit: number;
}
