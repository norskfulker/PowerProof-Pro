import { bundleTotals, priceInfo, ratingSummary } from "../../pricing";
import { sb } from "../../supabase/browser";
import type { Bundle, Question, Review, Store, StoreDesign } from "../../types";
import { ApiError } from "../client";
import type { ProductView, StorefrontView, StoreProduct } from "../storefront";
import { must } from "./errors";
import { collectionFrom, dealRuleFrom, designFrom, pagesFrom, productFrom, questionFrom, reviewFrom, storeFrom, type MediaRow, type ProductRow } from "./map";

/**
 * The public storefront, read the way a buyer would: with the anon key, so the database's row
 * level security decides what is visible (published stores, live products, published pages).
 */

/** Columns an anonymous visitor may read (owner, GSTIN and PAN are never among them). */
const STORE_COLS = "id, name, slug, tagline, logo_url, status, theme, theme_mode, currency_base, brand_color, support_email, refund_days, created_at";
const PRODUCT_COLS = "id, store_id, title, slug, description, status, currency, price_minor, min_price_minor, compare_at_price_minor, cover_bg, sku, hsn_sac, tax_rate_bps, product_type, source_url, created_at, updated_at";
const REVIEW_COLS = "id, store_id, product_id, reviewer_name, rating, title, body, photos, status, creator_reply, replied_at, created_at, pinned";
const QUESTION_COLS = "id, store_id, product_id, asker_name, body, answer, answered_at, status, created_at";

interface Loaded {
  view: StorefrontView;
  reviews: Review[];
  questions: Question[];
}

export async function load(slug: string): Promise<Loaded> {
  const client = sb();
  const storeRow = must(await client.from("stores").select(STORE_COLS).eq("slug", slug).maybeSingle(), { notFound: "Store" });
  const id = storeRow.id;
  const [productRows, collRows, rules, pageRows, customPages, reviewRows, questionRows] = await Promise.all([
    client.from("products").select(PRODUCT_COLS).eq("store_id", id).eq("status", "live").order("created_at", { ascending: false }),
    client.from("collections").select("*").eq("store_id", id).order("sort_order"),
    client.from("deal_rules").select("*").eq("store_id", id),
    client.from("store_pages").select("kind, content, edited").eq("store_id", id),
    client.from("custom_pages").select("title, slug, status").eq("store_id", id).eq("status", "published").order("sort_order"),
    client.from("reviews").select(REVIEW_COLS).eq("store_id", id).order("created_at", { ascending: false }),
    client.from("questions").select(QUESTION_COLS).eq("store_id", id).order("created_at", { ascending: false }),
  ]);
  const prows = must(productRows) as ProductRow[];
  const pids = prows.map((p) => p.id);
  const [media, items] = await Promise.all([
    pids.length ? client.from("product_media").select("*").in("product_id", pids) : Promise.resolve({ data: [], error: null }),
    collRows.data?.length ? client.from("collection_items").select("*").in("collection_id", collRows.data.map((c) => c.id)) : Promise.resolve({ data: [], error: null }),
  ]);

  // Owner details are private: buyers see the store's own name and support address
  const store: Store = storeFrom({ ...storeRow, status: storeRow.status }, { name: storeRow.name, email: storeRow.support_email ?? "" });
  const pagesInfo = pagesFrom(store, must(pageRows));
  const design: StoreDesign = designFrom(store, storeRow.theme, storeRow.theme_mode, pagesInfo.about);
  store.refundPolicy = pagesInfo.pages.refund;

  const reviews = must(reviewRows).map((r) => reviewFrom(r, r.pinned));
  const questions = must(questionRows).map((q) => questionFrom(q, store.name));
  const mediaRows = (media.data ?? []) as MediaRow[];

  const products: StoreProduct[] = prows.map((r) => {
    const p = productFrom(r, mediaRows);
    return { ...p, info: priceInfo(p, []), rating: ratingSummary(reviews.filter((x) => x.productId === p.id)) };
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const visible = reviews.filter((r) => !r.hidden && byId.has(r.productId));

  const bundles = must(rules)
    .map(dealRuleFrom)
    .flatMap((r): Bundle[] => (r.kind === "bundle_discount" ? [{ id: r.id, name: r.name, productIds: r.productIds, pricing: { kind: "percent", percent: r.percent }, active: r.active }] : []))
    .filter((b) => b.productIds.every((pid) => byId.has(pid)));

  const view: StorefrontView = {
    store,
    design,
    pages: pagesInfo.pages,
    extraPages: must(customPages).map((p) => ({ title: p.title, slug: p.slug })),
    products,
    collections: must(collRows)
      .map((c) => collectionFrom(c, (items.data ?? []) as never))
      .map((c) => ({ ...c, productIds: c.productIds.filter((pid) => byId.has(pid)) }))
      .filter((c) => c.productIds.length > 0),
    bundles: bundles.map((b) => ({ bundle: b, products: b.productIds.map((pid) => byId.get(pid)!), ...bundleTotals(b, products, []) })),
    rating: ratingSummary(visible),
    topReviews: visible
      .filter((r) => r.rating >= 4)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((r) => ({ ...r, productTitle: byId.get(r.productId)!.title, productSlug: byId.get(r.productId)!.slug })),
  };
  return { view, reviews, questions };
}

export async function getStorefront(slug: string): Promise<StorefrontView> {
  return (await load(slug)).view;
}

export async function previewStorefront(slug: string, design: StoreDesign): Promise<StorefrontView> {
  return { ...(await load(slug)).view, design };
}

export async function getStoreProduct(slug: string, productSlug: string): Promise<ProductView> {
  const { view, reviews, questions } = await load(slug);
  const product = view.products.find((p) => p.slug === productSlug);
  if (!product) throw new ApiError("Product not found.", "not_found");
  const sameCollection = new Set(view.collections.filter((c) => c.productIds.includes(product.id)).flatMap((c) => c.productIds));
  const others = view.products.filter((p) => p.id !== product.id);
  const related = [...others.filter((p) => sameCollection.has(p.id)), ...others.filter((p) => !sameCollection.has(p.id))].slice(0, 4);
  return {
    view,
    product,
    reviews: reviews.filter((r) => r.productId === product.id && !r.hidden),
    questions: questions.filter((q) => q.productId === product.id && !q.hidden),
    related,
    bundles: view.bundles.filter((b) => b.bundle.productIds.includes(product.id)),
  };
}

