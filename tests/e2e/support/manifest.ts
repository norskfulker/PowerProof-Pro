import fs from "node:fs";
import path from "node:path";

/** What the global setup created, so tests can use it and the teardown can remove it. */
export interface Manifest {
  tag: string;
  hasService: boolean;
  A: {
    userId: string;
    storeId: string;
    slug: string;
    storeName: string;
    productId: string;
    productSlug: string;
    productTitle: string;
    collectionId: string;
    collectionSlug: string;
    couponId: string;
    couponCode: string;
    pageId: string;
    pageSlug: string;
    orderId?: string;
    orderNumber?: string;
    reviewId?: string;
    reviewTitle?: string;
    secondProductId?: string;
    dealRuleId?: string;
    dealRuleName?: string;
  };
  B: { userId: string; storeId: string };
  /** What to put back at the end */
  original: { storeStatus: "draft" | "published" | "suspended"; plan: "free" | "pro" };
}

export const DIR = path.resolve(__dirname, "../.data");
export const MANIFEST = path.join(DIR, "manifest.json");
export const STATE = { A: path.join(DIR, "a.json"), B: path.join(DIR, "b.json") };

export function readManifest(): Manifest {
  if (!fs.existsSync(MANIFEST)) throw new Error("The e2e data isn't set up. Run the tests with `npx playwright test` so global setup runs first.");
  return JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Manifest;
}
