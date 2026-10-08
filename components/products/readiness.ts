import type { Product } from "@/lib/types";

export interface ReadyItem {
  key: "images" | "file" | "classification";
  label: string;
  done: boolean;
}

/**
 * What a product still needs before it is worth publishing: a picture or video, its file (digital),
 * and its classification (a type for digital, a collection for physical). Drafts show this list.
 */
export function readiness(p: Pick<Product, "fulfilment" | "images" | "video" | "files" | "kind">, inCollection: boolean): ReadyItem[] {
  const items: ReadyItem[] = [{ key: "images", label: "Images or video", done: p.images.length > 0 || !!p.video }];
  if (p.fulfilment === "digital") items.push({ key: "file", label: "File to download", done: p.files.length > 0 });
  items.push(p.fulfilment === "digital" ? { key: "classification", label: "Type", done: p.kind !== "other" } : { key: "classification", label: "Collection", done: inCollection });
  return items;
}

export const DRAFT_NOTE = "Draft: not visible to buyers until you publish.";

/** What must be true before a product can go live: a file to download (digital) or a collection (physical). Pictures and a type are advice, not rules. */
export function publishBlockers(p: Pick<Product, "fulfilment" | "files">, inCollection: boolean): string[] {
  if (p.fulfilment === "digital") return p.files.length ? [] : ["Add the file buyers will download."];
  return inCollection ? [] : ["Put it in a collection so buyers can find it."];
}
