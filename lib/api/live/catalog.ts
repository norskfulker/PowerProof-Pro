import { money as mkMoney } from "../../money";
import { slugify } from "../../slug";
import { TAX_CODES } from "../../tax-codes";
import { sb } from "../../supabase/browser";
import type { DealRuleInput } from "../../pricing/deal-rule-schema";
import { dealRuleSchema } from "../../pricing/deal-rule-schema";
import type { TablesUpdate } from "../../database.types";
import type { Bundle, Collection, Coupon, DealRule, Product, ProductInput, Question, Review, TaxCode } from "../../types";
import { ApiError } from "../client";
import type { ProductQuery } from "../products";
import type { InboxQuestion, InboxReview, Offers } from "../store-admin";
import type { NavCounts } from "../nav";
import { fail, must } from "./errors";
import { collectionFrom, dealRuleFrom, mediaUrl, productFrom, productType, questionFrom, reviewFrom, toDbStatus, type FileRow, type MediaRow, type ProductStats, type QuestionInput, type ReviewInput, type VariantRow } from "./map";
import { openDisputeOrderIds } from "./orders";
import { activeStoreId, currentUser } from "./session";
import { removeFromStorage } from "./upload";

/** Products, collections, coupons, deal paths, reviews and questions for the active store. */

const PRODUCT_COLS = "id, store_id, title, slug, description, status, currency, price_minor, min_price_minor, compare_at_price_minor, cover_bg, sku, hsn_sac, tax_rate_bps, product_type, fulfilment, source_url, created_at, updated_at, options, track_stock, stock, weight_grams";

/* Products ------------------------------------------------------------------ */

async function salesStats(storeId: string): Promise<Map<string, ProductStats>> {
  const { data } = await sb().from("order_items").select("product_id, quantity, line_total_minor, orders!inner(status, store_id)").eq("orders.store_id", storeId).eq("orders.status", "paid");
  const out = new Map<string, ProductStats>();
  for (const r of data ?? []) {
    if (!r.product_id) continue;
    const s = out.get(r.product_id) ?? { salesCount: 0, revenue: 0 };
    s.salesCount += r.quantity;
    s.revenue += Number(r.line_total_minor);
    out.set(r.product_id, s);
  }
  return out;
}

async function loadProducts(storeId: string, ids?: string[]): Promise<Product[]> {
  let q = sb().from("products").select(PRODUCT_COLS).eq("store_id", storeId).order("created_at", { ascending: false });
  if (ids) q = q.in("id", ids);
  const rows = must(await q);
  if (!rows.length) return [];
  const pids = rows.map((r) => r.id);
  const [media, files, stats, variants] = await Promise.all([
    sb().from("product_media").select("*").in("product_id", pids),
    sb().from("product_files").select("*").in("product_id", pids),
    salesStats(storeId),
    sb().from("product_variants").select("*").in("product_id", pids),
  ]);
  return rows.map((r) => productFrom(r, (media.data ?? []) as MediaRow[], (files.data ?? []) as FileRow[], stats.get(r.id), (variants.data ?? []) as VariantRow[]));
}

export async function getProducts(q: ProductQuery = {}): Promise<Product[]> {
  const s = q.search?.trim().toLowerCase();
  const all = await loadProducts(await activeStoreId());
  return all.filter(
    (p) =>
      (!s || p.title.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)) &&
      (!q.status || q.status === "all" || p.status === q.status) &&
      (!q.kind || q.kind === "all" || p.kind === q.kind)
  );
}

export async function getProduct(id: string): Promise<Product> {
  const [p] = await loadProducts(await activeStoreId(), [id]);
  if (!p) throw new ApiError("Product not found.", "not_found");
  return p;
}

/* Tax codes: the creator's own HSN/SAC codes (tax_codes table) ------------------------ */

type TaxRow = { id: string; code: string; kind: string; description: string; rate_bps: number };
const taxCodeFrom = (r: TaxRow): TaxCode => ({ id: r.id, code: r.code, kind: r.kind === "HSN" ? "HSN" : "SAC", description: r.description || "Your own code", rate: r.rate_bps / 100 });

export async function getCustomTaxCodes(): Promise<TaxCode[]> {
  const rows = must(await sb().from("tax_codes").select("id, code, kind, description, rate_bps").eq("store_id", await activeStoreId()).order("code"));
  return rows.map(taxCodeFrom);
}

export async function saveTaxCode(input: { code: string; kind: "HSN" | "SAC"; description?: string; rate: number }): Promise<TaxCode[]> {
  if (!/^\d{4,8}$/.test(input.code)) throw new ApiError("Tax codes are 4 to 8 digits.", "validation");
  if (!(input.rate >= 0 && input.rate <= 40)) throw new ApiError("GST is between 0% and 40%.", "validation");
  const r = await sb()
    .from("tax_codes")
    .insert({ store_id: await activeStoreId(), code: input.code, kind: input.kind, description: (input.description ?? "").trim().slice(0, 120), rate_bps: Math.round(input.rate * 100) })
    .select("id")
    .single();
  if (r.error) fail(r.error, { conflict: `You already saved ${input.code} at ${input.rate}%.` });
  return getCustomTaxCodes();
}

export async function deleteTaxCode(id: string): Promise<TaxCode[]> {
  const r = await sb().from("tax_codes").delete().eq("id", id);
  if (r.error) fail(r.error);
  return getCustomTaxCodes();
}

/** A code typed on a product is remembered, so it can be picked again. Reference codes aren't stored. */
async function rememberTaxCode(storeId: string, code: string | undefined, rate: number | undefined) {
  if (!code || rate === undefined || !/^\d{4,8}$/.test(code)) return;
  const bps = Math.round(Math.min(40, Math.max(0, rate)) * 100);
  if (TAX_CODES.some((t) => t.code === code && Math.round(t.rate * 100) === bps)) return;
  // Already saved is fine: the unique (store, code, rate) turns this into "nothing to do"
  await sb().from("tax_codes").upsert({ store_id: storeId, code, kind: code.startsWith("99") ? "SAC" : "HSN", rate_bps: bps }, { onConflict: "store_id,code,rate_bps", ignoreDuplicates: true });
}

/** A SKU or a name clash: the database says which in the error text. */
const productConflict = (e: { message?: string } | null) => (/sku/i.test(e?.message ?? "") ? "That SKU is already used by another product. Pick a different one." : "A product with this name already exists. Change the title a little.");

/** GST rate (basis points) for a tax code, from the GST reference list. */
function taxBps(code: string): number {
  const t = TAX_CODES.find((x) => x.code === code);
  return t ? Math.round(t.rate * 100) : 0;
}

function productRow(input: Partial<ProductInput> & { priceFloor?: Product["priceFloor"] }): TablesUpdate<"products"> {
  const row: TablesUpdate<"products"> = {};
  if (input.title !== undefined) row.title = input.title.trim().slice(0, 160);
  if (input.description !== undefined) row.description = input.description;
  if (input.kind !== undefined) row.product_type = productType(input.kind);
  if (input.fulfilment !== undefined) row.fulfilment = input.fulfilment;
  if (input.status !== undefined) row.status = toDbStatus(input.status);
  if (input.price !== undefined) {
    row.price_minor = Math.max(0, Math.round(input.price.amount));
    row.currency = input.price.currency;
  }
  if ("compareAt" in input) {
    const c = input.compareAt?.amount;
    // The database only takes a compare-at price above the price; anything else means "none"
    row.compare_at_price_minor = c && input.price && c > input.price.amount ? Math.round(c) : c && !input.price ? Math.round(c) : null;
  }
  if ("priceFloor" in input) row.min_price_minor = Math.max(0, Math.round(input.priceFloor?.amount ?? 0));
  if (input.sku !== undefined) row.sku = input.sku.trim() || null;
  if (input.taxCode !== undefined) {
    row.hsn_sac = input.taxCode || null;
    // A custom code brings its own rate; the reference codes use theirs
    row.tax_rate_bps = input.taxRate !== undefined ? Math.round(Math.min(40, Math.max(0, input.taxRate)) * 100) : taxBps(input.taxCode);
  }
  if ("sourceUrl" in input) row.source_url = input.sourceUrl && /^https:\/\//.test(input.sourceUrl) ? input.sourceUrl.slice(0, 2048) : null;
  if ("tileBackground" in input) row.cover_bg = input.tileBackground ? JSON.parse(JSON.stringify(input.tileBackground)) : null;
  // Variants, options and stock are for physical products
  if (input.options !== undefined) row.options = input.options.slice(0, 3).map((o) => ({ name: o.name.trim().slice(0, 40), values: o.values.map((v) => v.trim().slice(0, 60)).filter(Boolean).slice(0, 50) })).filter((o) => o.name && o.values.length);
  if (input.trackStock !== undefined) row.track_stock = input.trackStock;
  if ("stock" in input) row.stock = input.stock === undefined || input.stock === null ? null : Math.max(0, Math.round(input.stock));
  if ("weightGrams" in input) row.weight_grams = input.weightGrams === undefined ? null : Math.max(0, Math.round(input.weightGrams));
  return row;
}

/**
 * Saves a physical product's variants: kept ones are updated in place (so orders keep pointing at
 * them), new ones added, removed ones deleted. Stock is only kept when the product counts it.
 */
async function saveVariants(productId: string, input: Partial<ProductInput>) {
  if (input.variants === undefined) return;
  const client = sb();
  const current = must(await client.from("product_variants").select("id").eq("product_id", productId));
  const keep = new Set(input.variants.map((v) => v.id));
  const gone = current.filter((v) => !keep.has(v.id)).map((v) => v.id);
  if (gone.length) must(await client.from("product_variants").delete().in("id", gone).select("id"));
  const known = new Set(current.map((v) => v.id));
  const rows = input.variants.slice(0, 100).map((v, i) => ({
    product_id: productId,
    title: (v.title || v.options.join(" / ") || `Option ${i + 1}`).slice(0, 120),
    options: v.options.map((o) => o.slice(0, 60)),
    sku: v.sku.trim() || null,
    price_minor: Math.max(0, Math.round(v.price.amount)),
    compare_at_minor: v.compareAt && v.compareAt.amount > v.price.amount ? Math.round(v.compareAt.amount) : null,
    stock: input.trackStock ? Math.max(0, Math.round(v.stock ?? 0)) : null,
    image_url: v.image && /^https:\/\//.test(v.image) ? v.image.slice(0, 2048) : null,
    sort_order: i,
    ...(known.has(v.id) ? { id: v.id } : {}),
  }));
  const updates = rows.filter((r) => "id" in r);
  const inserts = rows.filter((r) => !("id" in r));
  for (const u of updates) must(await client.from("product_variants").update(u).eq("id", (u as { id: string }).id).select("id"));
  if (inserts.length) {
    const r = await client.from("product_variants").insert(inserts).select("id");
    if (r.error) fail(r.error);
  }
}

/** Replaces the product's gallery and video, and syncs its files with what the form holds. */
async function saveAttachments(productId: string, input: Partial<ProductInput>) {
  const client = sb();
  if (input.images !== undefined || "video" in input) {
    const current = must(await client.from("product_media").select("id, kind").eq("product_id", productId));
    const media: Record<string, unknown>[] = [];
    if (input.images !== undefined) {
      input.images.forEach((img, i) => {
        const url = mediaUrl(img);
        if (url) media.push({ product_id: productId, kind: "image", url, alt: img.alt || null, sort_order: i, focal_x: img.focal?.x ?? 50, focal_y: img.focal?.y ?? 50 });
      });
    }
    if ("video" in input && input.video?.src && /^https:\/\//.test(input.video.src)) {
      media.push({ product_id: productId, kind: "video", url: input.video.src, alt: input.video.alt || null, poster_url: input.video.poster && /^https:\/\//.test(input.video.poster) ? input.video.poster : null, sort_order: 100, focal_x: input.video.focal?.x ?? 50, focal_y: input.video.focal?.y ?? 50 });
    }
    const replace = current.filter((m) => (input.images !== undefined && m.kind === "image") || ("video" in input && m.kind === "video")).map((m) => m.id);
    if (replace.length) must(await client.from("product_media").delete().in("id", replace).select("id"));
    if (media.length) must(await client.from("product_media").insert(media as never).select("id"));
  }
  if (input.files !== undefined) {
    const current = must(await client.from("product_files").select("id, storage_path").eq("product_id", productId));
    const keep = new Set(input.files.map((f) => f.path).filter(Boolean));
    const gone = current.filter((f) => !keep.has(f.storage_path));
    const known = new Set(current.map((f) => f.storage_path));
    const added = input.files.filter((f) => f.path && !known.has(f.path));
    if (input.files.some((f) => !f.path)) throw new ApiError("A file is still uploading. Wait for it to finish, then save.", "validation");
    if (gone.length) {
      must(await client.from("product_files").delete().in("id", gone.map((f) => f.id)).select("id"));
      await removeFromStorage("product-files", gone.map((f) => f.storage_path));
    }
    if (added.length) {
      must(await client.from("product_files").insert(added.map((f) => ({ product_id: productId, storage_path: f.path!, file_name: f.name.slice(0, 200), size_bytes: f.size, mime_type: f.mime }))).select("id"));
    }
  }
}

async function uniqueSlug(storeId: string, title: string, table: "products" | "collections") {
  const base = (slugify(title) || "item").slice(0, 70);
  const { data } = await sb().from(table).select("slug").eq("store_id", storeId).like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r) => String(r.slug)));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const storeId = await activeStoreId();
  const slug = await uniqueSlug(storeId, input.title, "products");
  const r = await sb()
    .from("products")
    .insert({ ...productRow(input), store_id: storeId, slug, title: input.title.trim() })
    .select("id")
    .single();
  if (r.error) fail(r.error, { conflict: productConflict(r.error) });
  await saveAttachments(r.data.id, input);
  await saveVariants(r.data.id, input);
  await rememberTaxCode(storeId, input.taxCode, input.taxRate);
  return getProduct(r.data.id);
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  const row = productRow(patch);
  if (row.compare_at_price_minor !== undefined && patch.price === undefined) {
    const cur = await getProduct(id);
    if (row.compare_at_price_minor !== null && Number(row.compare_at_price_minor) <= cur.price.amount) row.compare_at_price_minor = null;
  }
  if (Object.keys(row).length) {
    const r = await sb().from("products").update(row).eq("id", id).select("id").single();
    if (r.error) fail(r.error, { notFound: "Product", conflict: productConflict(r.error) });
  }
  await saveAttachments(id, patch);
  await saveVariants(id, patch);
  if (patch.taxCode) await rememberTaxCode(await activeStoreId(), patch.taxCode, patch.taxRate);
  return getProduct(id);
}

export async function deleteProduct(id: string): Promise<void> {
  const client = sb();
  // Sold products keep their order history: archive instead of deleting
  const { count } = await client.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
  if (count) {
    must(await client.from("products").update({ status: "archived" }).eq("id", id).select("id").single());
    return;
  }
  const files = must(await client.from("product_files").select("storage_path").eq("product_id", id));
  await client.from("collection_items").delete().eq("product_id", id);
  await client.from("product_media").delete().eq("product_id", id);
  await client.from("product_files").delete().eq("product_id", id);
  const r = await client.from("products").delete().eq("id", id);
  if (r.error) {
    if (r.error.code === "23503") throw new ApiError("A deal path or coupon still uses this product. Remove it there first, or archive the product.", "conflict");
    fail(r.error);
  }
  await removeFromStorage("product-files", files.map((f) => f.storage_path));
}

export async function duplicateProduct(id: string): Promise<Product> {
  const src = await getProduct(id);
  // Files aren't copied: each product owns its own private files
  return createProduct({
    title: `${src.title} (copy)`.slice(0, 160),
    description: src.description,
    kind: src.kind,
    fulfilment: src.fulfilment,
    price: src.price,
    compareAt: src.compareAt,
    images: src.images,
    files: [],
    sku: src.sku ? `${src.sku}-C` : "",
    taxCode: src.taxCode,
    status: "draft",
    video: src.video,
    tileBackground: src.tileBackground,
    sourceUrl: src.sourceUrl,
  });
}

/* Collections --------------------------------------------------------------- */

export async function getCollections(): Promise<Collection[]> {
  const storeId = await activeStoreId();
  const rows = must(await sb().from("collections").select("*").eq("store_id", storeId).order("sort_order").order("created_at"));
  if (!rows.length) return [];
  const items = must(await sb().from("collection_items").select("*").in("collection_id", rows.map((r) => r.id)));
  return rows.map((r) => collectionFrom(r, items));
}

export async function saveCollection(c: Omit<Collection, "id" | "slug"> & { id?: string }): Promise<Collection[]> {
  if (c.name.trim().length < 2) throw new ApiError("Name the collection.", "validation");
  const storeId = await activeStoreId();
  const client = sb();
  const bg = JSON.parse(JSON.stringify({ background: c.background, cover: c.cover }));
  let id = c.id;
  if (id) {
    must(await client.from("collections").update({ name: c.name.trim().slice(0, 80), bg }).eq("id", id).select("id").single(), { notFound: "Collection" });
    must(await client.from("collection_items").delete().eq("collection_id", id).select("product_id"));
  } else {
    const existing = await getCollections();
    const r = await client
      .from("collections")
      .insert({ store_id: storeId, name: c.name.trim().slice(0, 80), slug: await uniqueSlug(storeId, c.name, "collections"), bg, sort_order: existing.length })
      .select("id")
      .single();
    if (r.error) fail(r.error, { conflict: "You already have a collection with this name." });
    id = r.data.id;
  }
  if (c.productIds.length) must(await client.from("collection_items").insert(c.productIds.map((product_id, i) => ({ collection_id: id!, product_id, sort_order: i }))).select("product_id"));
  return getCollections();
}

/** The collections a product is in. Optional: a product can be in none. */
export async function getProductCollectionIds(productId: string): Promise<string[]> {
  const rows = must(await sb().from("collection_items").select("collection_id").eq("product_id", productId));
  return rows.map((r) => r.collection_id);
}

/** Puts a product in exactly these collections (adding and removing as needed). */
export async function setProductCollections(productId: string, collectionIds: string[]): Promise<void> {
  const client = sb();
  const have = await getProductCollectionIds(productId);
  const add = collectionIds.filter((id) => !have.includes(id));
  const drop = have.filter((id) => !collectionIds.includes(id));
  if (drop.length) must(await client.from("collection_items").delete().eq("product_id", productId).in("collection_id", drop).select("product_id"));
  if (add.length) {
    const counts = await Promise.all(add.map((id) => client.from("collection_items").select("product_id", { count: "exact", head: true }).eq("collection_id", id)));
    must(await client.from("collection_items").insert(add.map((collection_id, i) => ({ collection_id, product_id: productId, sort_order: counts[i].count ?? 0 }))).select("product_id"));
  }
}

export async function deleteCollection(id: string): Promise<Collection[]> {
  await sb().from("collection_items").delete().eq("collection_id", id);
  const r = await sb().from("collections").delete().eq("id", id);
  if (r.error) fail(r.error);
  return getCollections();
}

export async function moveCollection(id: string, dir: -1 | 1): Promise<Collection[]> {
  const list = await getCollections();
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((c, n) => sb().from("collections").update({ sort_order: n }).eq("id", c.id)));
  return getCollections();
}

/* Coupons --------------------------------------------------------------------- */

/**
 * coupons.value is basis points for percent codes (1000 = 10%) and minor units for fixed ones.
 * A code works on the whole store or on one product. Bundles and timed sales live in deal paths.
 */
function couponFrom(r: { id: string; code: string; kind: "percent" | "fixed"; value: number; ends_at: string | null; max_uses: number | null; used_count: number; product_id: string | null; min_subtotal_minor: number; active: boolean; currency: string | null }): Coupon {
  return {
    id: r.id,
    code: r.code.toUpperCase(),
    kind: r.kind,
    value: r.kind === "percent" ? Math.round(r.value / 100) : Number(r.value),
    expiresAt: r.ends_at ?? undefined,
    usageLimit: r.max_uses ?? undefined,
    used: r.used_count,
    scope: r.product_id ? "products" : "store",
    productIds: r.product_id ? [r.product_id] : [],
    minSpend: r.min_subtotal_minor > 0 ? mkMoney(Number(r.min_subtotal_minor), (r.currency as "INR") ?? "INR") : undefined,
    active: r.active,
  };
}

export async function getOffers(): Promise<Offers> {
  const rows = must(await sb().from("coupons").select("*").eq("store_id", await activeStoreId()).order("created_at", { ascending: false }));
  // Bundles are bundle-discount deal paths; timed store-wide sales aren't available yet
  const rules = await getDealRules();
  const bundles: Bundle[] = rules.flatMap((r) => (r.kind === "bundle_discount" ? [{ id: r.id, name: r.name, productIds: r.productIds, pricing: { kind: "percent" as const, percent: r.percent }, active: r.active }] : []));
  return { coupons: rows.map(couponFrom), bundles, deals: [] };
}

export async function saveCoupon(c: Omit<Coupon, "id" | "used"> & { id?: string }): Promise<Offers> {
  const code = c.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new ApiError("Codes are 3 to 20 letters or numbers, no spaces.", "validation");
  if (c.kind === "percent" && (c.value < 1 || c.value > 90)) throw new ApiError("Percent off must be between 1 and 90.", "validation");
  if (c.kind === "fixed" && c.value < 100) throw new ApiError("Fixed discounts start at ₹1.00.", "validation");
  if (c.scope === "products" && c.productIds.length === 0) throw new ApiError("Pick the products this code works on.", "validation");
  if (c.scope === "products" && c.productIds.length > 1) throw new ApiError("A code can work on the whole store or on one product. Make one code per product.", "validation");
  const storeId = await activeStoreId();
  const { data: store } = await sb().from("stores").select("currency_base").eq("id", storeId).single();
  const row = {
    code,
    kind: c.kind,
    value: c.kind === "percent" ? c.value * 100 : Math.round(c.value),
    currency: c.kind === "fixed" ? store?.currency_base ?? "INR" : null,
    ends_at: c.expiresAt ?? null,
    max_uses: c.usageLimit ?? null,
    product_id: c.scope === "products" ? c.productIds[0] : null,
    min_subtotal_minor: c.minSpend?.amount ?? 0,
    active: c.active,
  };
  const r = c.id ? await sb().from("coupons").update(row).eq("id", c.id).select("id").single() : await sb().from("coupons").insert({ ...row, store_id: storeId }).select("id").single();
  if (r.error) fail(r.error, { conflict: `${code} already exists.` });
  return getOffers();
}

export async function deleteCoupon(id: string): Promise<Offers> {
  const r = await sb().from("coupons").delete().eq("id", id);
  if (r.error) {
    // Codes buyers have used stay for the order history: switch them off instead
    if (r.error.code === "23503") must(await sb().from("coupons").update({ active: false }).eq("id", id).select("id").single());
    else fail(r.error);
  }
  return getOffers();
}

/** A bundle is a deal path: every product in it together, percent off each. */
export async function saveBundle(b: Omit<Bundle, "id"> & { id?: string }): Promise<Offers> {
  if (b.name.trim().length < 2) throw new ApiError("Name the bundle.", "validation");
  if (b.productIds.length < 2 || b.productIds.length > 5) throw new ApiError("Bundles have 2 to 5 products.", "validation");
  if (b.pricing.kind !== "percent") throw new ApiError("A fixed bundle price is coming soon. Set a percent off for now.", "validation");
  await saveDealRule({ id: b.id, kind: "bundle_discount", name: b.name.trim().slice(0, 60), productIds: b.productIds, percent: b.pricing.percent, active: b.active, stackable: false });
  return getOffers();
}

export async function saveDeal(): Promise<Offers> {
  throw new ApiError("Limited-time deals are coming soon. Make a deal path with an end date for now.", "validation");
}

/* Deal paths ------------------------------------------------------------------- */

export async function getDealRules(): Promise<DealRule[]> {
  const rows = must(await sb().from("deal_rules").select("*").eq("store_id", await activeStoreId()).order("sort_order").order("created_at", { ascending: false }));
  return rows.map(dealRuleFrom);
}

export async function getDealRule(id: string): Promise<DealRule> {
  return dealRuleFrom(must(await sb().from("deal_rules").select("*").eq("id", id).single(), { notFound: "Deal path" }));
}

export async function saveDealRule(input: DealRuleInput): Promise<DealRule> {
  const parsed = dealRuleSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(parsed.error.issues[0].message, "validation");
  const r = parsed.data;
  const base = { name: r.name.trim(), active: r.active, starts_at: r.startsAt ?? null, ends_at: r.endsAt ?? null };
  let row;
  if (r.kind === "bundle_discount") {
    if (r.productIds.length > 5) throw new ApiError("Pick up to five products.", "validation");
    row = { ...base, reward: "percent_off" as const, trigger_product_ids: r.productIds, percent_bps: r.percent * 100, reward_product_id: null };
  } else if (r.kind === "free_gift" && r.triggerIds.length > 0 && !r.minSpend) {
    if (r.triggerIds.length > 5) throw new ApiError("Pick up to five products that unlock the gift.", "validation");
    row = { ...base, reward: "free_product" as const, trigger_product_ids: r.triggerIds, reward_product_id: r.giftId, percent_bps: null };
  } else {
    throw new ApiError(
      r.kind === "free_gift"
        ? "For now a free gift needs at least one product that unlocks it, and no minimum spend."
        : "This kind of deal path is coming soon. Use a bundle discount or a free gift for now.",
      "validation"
    );
  }
  const storeId = await activeStoreId();
  const res = r.id ? await sb().from("deal_rules").update(row).eq("id", r.id).select("*").single() : await sb().from("deal_rules").insert({ ...row, store_id: storeId }).select("*").single();
  if (res.error) {
    if (/product/i.test(res.error.message)) throw new ApiError("One of the products no longer exists. Pick again.", "validation");
    fail(res.error);
  }
  return dealRuleFrom(res.data);
}

export async function setDealRuleActive(id: string, active: boolean): Promise<DealRule> {
  return dealRuleFrom(must(await sb().from("deal_rules").update({ active }).eq("id", id).select("*").single(), { notFound: "Deal path" }));
}

export async function deleteDealRule(id: string): Promise<void> {
  const r = await sb().from("deal_rules").delete().eq("id", id);
  if (r.error) fail(r.error);
}

/* Reviews and questions ---------------------------------------------------------- */

const REVIEW_COLS = "id, store_id, product_id, reviewer_name, rating, title, body, photos, status, creator_reply, replied_at, created_at, pinned";
const MAX_PINNED = 3;

async function titles(storeId: string) {
  const rows = must(await sb().from("products").select("id, title, slug").eq("store_id", storeId));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function getReviewsInbox(): Promise<InboxReview[]> {
  const storeId = await activeStoreId();
  // creator_reviews carries the product title; the base `reviews` table refuses `select *`
  const rows = must(await sb().from("creator_reviews").select("*").eq("store_id", storeId).order("created_at", { ascending: false }));
  return rows.map((r) => ({ ...reviewFrom(r as ReviewInput, !!r.pinned), productTitle: r.product_title ?? "Removed product" }));
}

export async function replyToReview(id: string, body: string): Promise<Review> {
  if (body.trim().length < 2) throw new ApiError("Write a reply first.", "validation");
  // creator_reply is the only column a creator may change on a review
  const row = must(await sb().from("reviews").update({ creator_reply: body.trim().slice(0, 1000) }).eq("id", id).select(REVIEW_COLS).single(), { notFound: "Review" });
  return reviewFrom(row, row.pinned);
}

export async function setReviewFlag(id: string, flag: "pinned" | "hidden", value: boolean): Promise<Review> {
  if (flag === "hidden") throw new ApiError("Only PowerProof can hide a review. If it breaks the rules, write to support and we'll look at it.", "validation");
  const storeId = await activeStoreId();
  if (value) {
    const { count } = await sb().from("reviews").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("pinned", true).neq("id", id);
    if ((count ?? 0) >= MAX_PINNED) throw new ApiError("You can pin up to 3 reviews. Unpin one first.", "conflict");
  }
  const row = must(await sb().from("reviews").update({ pinned: value }).eq("id", id).select(REVIEW_COLS).single(), { notFound: "Review" });
  return reviewFrom(row, row.pinned);
}

const QUESTION_COLS = "id, store_id, product_id, asker_name, body, answer, answered_at, status, created_at";

export async function getQuestionsInbox(): Promise<InboxQuestion[]> {
  const storeId = await activeStoreId();
  const [rows, names, me] = await Promise.all([sb().from("creator_questions").select("*").eq("store_id", storeId).order("created_at", { ascending: false }), titles(storeId), currentUser()]);
  return must(rows).map((q) => ({ ...questionFrom(q as QuestionInput, me.name.split(" ")[0]), productTitle: q.product_title ?? "Removed product", productSlug: names.get(q.product_id ?? "")?.slug ?? "" }));
}

export async function answerQuestion(id: string, body: string): Promise<Question> {
  if (body.trim().length < 2) throw new ApiError("Write an answer first.", "validation");
  const me = await currentUser();
  // answer is the only column a creator may change on a question; a new answer replaces the old one
  const row = must(await sb().from("questions").update({ answer: body.trim().slice(0, 1500) }).eq("id", id).select(QUESTION_COLS).single(), { notFound: "Question" });
  return questionFrom(row, me.name.split(" ")[0]);
}

export async function setQuestionHidden(id: string, hidden: boolean): Promise<Question> {
  void id;
  void hidden;
  throw new ApiError("Only PowerProof can hide a question. If it breaks the rules, write to support and we'll look at it.", "validation");
}

/* Menu counts --------------------------------------------------------------------- */

export async function getNavCounts(): Promise<NavCounts> {
  const storeId = await activeStoreId();
  const [products, reviews, questions] = await Promise.all([
    sb().from("products").select("id, title, status").eq("store_id", storeId),
    sb().from("creator_reviews").select("id", { count: "exact", head: true }).eq("store_id", storeId).is("creator_reply", null).eq("status", "published"),
    sb().from("creator_questions").select("id", { count: "exact", head: true }).eq("store_id", storeId).is("answer", null),
  ]);
  const ps = products.data ?? [];
  const disputed = await openDisputeOrderIds(storeId).catch(() => new Set<string>());
  return {
    storeId,
    counts: {
      products_all: ps.length,
      products_live: ps.filter((p) => p.status === "live").length,
      products_draft: ps.filter((p) => p.status === "draft").length,
      products_archived: ps.filter((p) => p.status === "archived").length,
      reviews_pending: reviews.count ?? 0,
      questions_open: questions.count ?? 0,
      orders_disputed: disputed.size,
    },
  };
}
