import { blankProduct } from "@/components/products/to-values";
import { productSchema, type ProductValues } from "@/components/products/product-schema";
import { parseCsv, toCsv } from "./csv";
import type { CurrencyCode } from "./types";

/**
 * The spreadsheet format for adding many products at once. Everything imports as a draft: a digital
 * product needs its file before it can go live, and files are added on the product afterwards.
 * Each row is checked with the same rules as the product form.
 */
export const PRODUCT_COLUMNS = [
  { key: "title", required: true, hint: "3 to 120 characters" },
  { key: "description", required: true, hint: "At least a sentence (20 characters)" },
  { key: "type", required: false, hint: "digital or physical. Blank means digital" },
  { key: "kind", required: false, hint: "Digital only: ebook, template, preset, notion, course, audio or other. Blank means other" },
  { key: "price", required: true, hint: "In your store's currency, e.g. 499 or 499.50" },
  { key: "original_price", required: false, hint: "Higher than price, to show a discount" },
  { key: "sku", required: false, hint: "Letters, numbers, dashes. Blank to auto-create" },
  { key: "hsn_sac", required: false, hint: "4 to 8 digits. Needed for physical products; blank means 998433 for digital" },
  { key: "gst_rate", required: false, hint: "0 to 40. Needed for physical products; blank means 18 for digital" },
  { key: "collection", required: false, hint: "A collection name (made if it doesn't exist). Needed for physical products" },
] as const;

export const MAX_IMPORT_ROWS = 500;
const KINDS = ["ebook", "template", "preset", "notion", "course", "audio", "other"] as const;

export function templateCsv(): string {
  return toCsv([
    PRODUCT_COLUMNS.map((c) => c.key),
    ["Sample planner (replace or delete this row)", "A printable weekly planner with habit tracker and goals pages.", "digital", "template", "499", "799", "PLAN-001", "", "", ""],
    ["Sample notebook (replace or delete this row)", "A hardbound dotted notebook, 200 pages, ships in 3 days.", "physical", "", "350", "", "NOTE-001", "4820", "12", "Notebooks"],
  ]);
}

export interface ImportRow {
  /** Line in the file, counting the header as 1 */
  line: number;
  title: string;
  values?: ProductValues;
  /** Collection to put it in, by name */
  collection?: string;
  error?: string;
}

export function parseProducts(text: string, currency: CurrencyCode): { rows: ImportRow[]; fileError?: string } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], fileError: "That file is empty." };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = PRODUCT_COLUMNS.filter((c) => c.required && !header.includes(c.key)).map((c) => c.key);
  if (missing.length) return { rows: [], fileError: `The first row needs these columns: ${missing.join(", ")}. Download the template to see the format.` };
  const body = table.slice(1);
  if (!body.length) return { rows: [], fileError: "There are no products under the column names." };
  if (body.length > MAX_IMPORT_ROWS) return { rows: [], fileError: `Up to ${MAX_IMPORT_ROWS} products per file. This one has ${body.length}.` };

  const rows = body.map((r, i): ImportRow => {
    const get = (key: string) => (r[header.indexOf(key)] ?? "").trim();
    const line = i + 2;
    const title = get("title");
    const rawType = get("type").toLowerCase() || "digital";
    if (rawType !== "digital" && rawType !== "physical") return { line, title, error: `Type must be digital or physical, not “${get("type")}”.` };
    const major = (key: string): number | undefined | null => {
      const t = get(key).replace(/[,\s]/g, "");
      if (!t) return undefined;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const kind = get("kind").toLowerCase() || "other";
    if (!(KINDS as readonly string[]).includes(kind)) return { line, title, error: `Kind must be one of ${KINDS.join(", ")}, not “${get("kind")}”.` };
    const price = major("price");
    const original = major("original_price");
    if (price == null) return { line, title, error: price === null ? "Price should be a number like 499 or 499.50." : "Price is missing." };
    if (original === null) return { line, title, error: "Original price should be a number." };
    const rate = get("gst_rate") ? Number(get("gst_rate")) : undefined;
    if (rate !== undefined && !Number.isFinite(rate)) return { line, title, error: "GST rate should be a number." };

    const base = blankProduct(rawType, currency);
    const collection = get("collection") || undefined;
    const candidate: ProductValues = {
      ...base,
      title,
      description: get("description"),
      kind: kind as ProductValues["kind"],
      price: { amount: Math.round(price * 100), currency },
      compareAt: original ? { amount: Math.round(original * 100), currency } : undefined,
      sku: get("sku"),
      taxCode: get("hsn_sac") || base.taxCode,
      taxRate: rate ?? base.taxRate,
      status: "draft",
      // The real collection is made or found at import time; this only satisfies the check that a physical product has one
      collectionIds: collection ? ["pending"] : [],
    };
    if (rawType === "physical" && !get("hsn_sac")) return { line, title, error: "Physical products need an HSN code (hsn_sac)." };
    if (rawType === "physical" && rate === undefined) return { line, title, error: "Physical products need a GST rate (gst_rate)." };
    const parsed = productSchema.safeParse(candidate);
    if (!parsed.success) return { line, title, error: parsed.error.issues[0]?.message ?? "Something is wrong in this row." };
    return { line, title, values: parsed.data, collection };
  });

  // Two rows with the same SKU would collide in the database
  const seen = new Map<string, number>();
  for (const r of rows) {
    const sku = r.values?.sku.toLowerCase();
    if (!r.values || !sku) continue;
    if (seen.has(sku)) {
      r.error = `SKU “${r.values.sku}” is also on line ${seen.get(sku)}.`;
      r.values = undefined;
    } else seen.set(sku, r.line);
  }
  return { rows };
}
