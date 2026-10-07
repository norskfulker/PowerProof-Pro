import type { Json } from "../database.types";
import { pageDocSchema, PAGE_SLUG, type PageDoc, type PageVersion, type StorePageDoc } from "../pages/schema";
import { PAGE_TEMPLATES, templateById } from "../pages/templates";
import { publicName } from "../pricing";
import { slugify } from "../slug";
import { sb } from "../supabase/browser";
import type { Collection, PriceInfo, Product, RatingSummary, Store, StoreTheme } from "../types";
import { ApiError } from "./client";
import { getCollections, getProducts } from "./live/catalog";
import { fail, must } from "./live/errors";
import { activeStoreId } from "./live/session";
import { load } from "./live/storefront";
import { getStore, getStoreDesign } from "./live/store";

/**
 * Visual store pages. Each page keeps a working draft (autosaved), the published version buyers
 * see, and up to 20 versions, all in custom_pages.layout. Only published pages are public.
 */

export type VisualPageStatus = "published" | "draft" | "changed";

export interface VisualPageSummary {
  id: string;
  title: string;
  slug: string;
  template: string;
  status: VisualPageStatus;
  updatedAt: string;
  publishedAt?: string;
  sections: number;
}

export interface RenderProduct extends Product {
  info: PriceInfo;
  rating: RatingSummary;
}

/** Everything the renderer needs besides the page itself. */
export interface RenderContext {
  store: Store;
  theme: StoreTheme;
  products: RenderProduct[];
  collections: Collection[];
  reviews: { id: string; title: string; body: string; author: string; rating: number }[];
}

const MAX_VERSIONS = 20;
const same = (a?: PageDoc, b?: PageDoc) => JSON.stringify(a) === JSON.stringify(b);

export function visualStatus(p: StorePageDoc): VisualPageStatus {
  if (!p.published) return "draft";
  return same(p.draft, p.published) ? "published" : "changed";
}

function summary(p: StorePageDoc): VisualPageSummary {
  return { id: p.id, title: p.title, slug: p.slug, template: p.template, status: visualStatus(p), updatedAt: p.updatedAt, publishedAt: p.publishedAt, sections: p.draft.blocks.length };
}

function validate(doc: PageDoc): PageDoc {
  const r = pageDocSchema.safeParse(doc);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new ApiError(`That page has a problem: ${i.message}`, "validation");
  }
  return r.data;
}

/**
 * custom_pages.layout holds everything about a page except its id, title, slug and status:
 * `{ template: "launch" | "sale" | "bio" | "blank", sections: [...], ... }`. `sections` is the
 * working draft; `published` holds the version buyers see, and `versions` the history.
 */
interface Layout {
  template: string;
  sections: PageDoc["blocks"];
  style?: PageDoc["style"];
  published?: PageDoc;
  publishedAt?: string;
  seo: StorePageDoc["seo"];
  versions: PageVersion[];
  /** Pages saved before `sections` existed */
  draft?: PageDoc;
}

interface Row {
  id: string;
  title: string;
  slug: string;
  layout: Json;
  updated_at: string;
}

const COLS = "id, title, slug, layout, updated_at";

/** Template names as stored: the old names map onto the four kinds */
const KIND: Record<string, string> = { launch: "launch", sale: "sale", bio: "bio", link_in_bio: "bio", blank: "blank" };

function docFrom(r: Row): StorePageDoc {
  const l = r.layout as unknown as Layout;
  const draft: PageDoc = l.draft ?? { version: 1, blocks: l.sections ?? [], ...(l.style ? { style: l.style } : {}) };
  return { id: r.id, title: r.title, slug: r.slug, template: KIND[l.template] ?? "blank", draft, published: l.published, publishedAt: l.publishedAt, updatedAt: r.updated_at, seo: l.seo, versions: l.versions ?? [] };
}

const layoutOf = (p: StorePageDoc): Json => JSON.parse(JSON.stringify({ template: p.template, sections: p.draft.blocks, ...(p.draft.style ? { style: p.draft.style } : {}), published: p.published, publishedAt: p.publishedAt, seo: p.seo, versions: p.versions } satisfies Layout));

async function mine(id: string): Promise<StorePageDoc> {
  return docFrom(must(await sb().from("custom_pages").select(COLS).eq("id", id).single(), { notFound: "Page" }) as Row);
}

async function save(p: StorePageDoc, extra: { title?: string; slug?: string } = {}): Promise<StorePageDoc> {
  const r = await sb()
    .from("custom_pages")
    .update({ layout: layoutOf(p), status: p.published ? "published" : "draft", title: (extra.title ?? p.title).slice(0, 80), ...(extra.slug ? { slug: extra.slug } : {}) })
    .eq("id", p.id)
    .select(COLS)
    .single();
  if (r.error) fail(r.error, { conflict: "Another page already uses that address.", notFound: "Page" });
  return docFrom(r.data as Row);
}

async function uniqueSlug(base: string, except?: string): Promise<string> {
  const { data } = await sb().from("custom_pages").select("id, slug").eq("store_id", await activeStoreId());
  const taken = new Set((data ?? []).filter((p) => p.id !== except).map((p) => String(p.slug)));
  const root = slugify(base) || "page";
  let s = root;
  for (let i = 2; taken.has(s); i++) s = `${root}-${i}`;
  return s;
}

/** What a page needs to draw products, collections and reviews: the store as a buyer sees it. */
export async function renderContextFor(storeSlug: string): Promise<RenderContext> {
  const { view } = await load(storeSlug);
  return {
    store: view.store,
    theme: view.design.theme,
    products: view.products,
    collections: view.collections,
    reviews: view.topReviews.map((r) => ({ id: r.id, title: r.title, body: r.body, author: publicName(r.author), rating: r.rating })),
  };
}

/* ------------------------------------------------------------------ */
/* Creator                                                              */
/* ------------------------------------------------------------------ */

export async function getVisualPages(): Promise<VisualPageSummary[]> {
  const rows = must(await sb().from("custom_pages").select(COLS).eq("store_id", await activeStoreId()));
  return (rows as Row[]).map(docFrom).map(summary).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function getVisualPage(id: string): Promise<{ page: StorePageDoc; context: RenderContext }> {
  const [page, store] = await Promise.all([mine(id), getStore()]);
  return { page, context: await renderContextFor(store.slug) };
}

export function getPageTemplates() {
  return PAGE_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
}

/** The page at a store's home address, if the creator made one. */
export const HOME_PAGE_SLUG = "home";

export function pageUrl(storeSlug: string, pageSlug: string) {
  return pageSlug === HOME_PAGE_SLUG ? `/s/${storeSlug}` : `/s/${storeSlug}/p/${pageSlug}`;
}

export async function createVisualPage(input: { templateId: string; title: string }): Promise<StorePageDoc> {
  const title = input.title.trim();
  if (title.length < 2) throw new ApiError("Give the page a name.", "validation");
  const [store, products, collections, design] = await Promise.all([getStore(), getProducts(), getCollections(), getStoreDesign()]);
  const doc = validate(
    templateById(input.templateId).build({
      storeName: store.name,
      ownerName: store.ownerName,
      slug: store.slug,
      products: products.filter((p) => p.status === "published").map((p) => ({ id: p.id, title: p.title })),
      collections: collections.map((c) => ({ slug: c.slug, name: c.name })),
      brand: store.brandColor,
      accent: "#C9A24F",
      now: Date.now(),
    })
  );
  const page: StorePageDoc = { id: "", title, slug: await uniqueSlug(title), template: input.templateId, draft: doc, updatedAt: new Date().toISOString(), seo: { title: `${title} · ${store.name}`, description: design.seo.description || store.tagline }, versions: [] };
  const r = await sb()
    .from("custom_pages")
    .insert({ store_id: await activeStoreId(), title: title.slice(0, 80), slug: page.slug, layout: layoutOf(page), status: "draft" })
    .select(COLS)
    .single();
  if (r.error) fail(r.error, { conflict: "Another page already uses that address." });
  return docFrom(r.data as Row);
}

/** Autosave. Validates so a broken tree is never stored. */
export async function saveVisualDraft(id: string, doc: PageDoc, meta?: { title?: string }): Promise<{ updatedAt: string; status: VisualPageStatus }> {
  const p = await mine(id);
  const saved = await save({ ...p, draft: validate(doc) }, { title: meta?.title?.trim() || undefined });
  return { updatedAt: saved.updatedAt, status: visualStatus(saved) };
}

export async function publishVisualPage(id: string): Promise<StorePageDoc> {
  const p = await mine(id);
  const clean = validate(p.draft);
  const at = new Date().toISOString();
  const version: PageVersion = { id: `pv_${Date.now().toString(36)}`, at, label: "Published", doc: clean };
  return save({ ...p, published: clean, publishedAt: at, versions: [version, ...p.versions].slice(0, MAX_VERSIONS) });
}

/** Throws away unpublished changes: the draft goes back to what buyers see. */
export async function discardVisualDraft(id: string): Promise<StorePageDoc> {
  const p = await mine(id);
  if (!p.published) throw new ApiError("This page has never been published, so there's nothing to go back to.", "conflict");
  return save({ ...p, draft: p.published });
}

/** Copies an old version into the draft. Buyers keep seeing the published page until you publish. */
export async function restoreVisualVersion(id: string, versionId: string): Promise<StorePageDoc> {
  const p = await mine(id);
  const v = p.versions.find((x) => x.id === versionId);
  if (!v) throw new ApiError("Version not found.", "not_found");
  return save({ ...p, draft: v.doc });
}

export async function updateVisualPageMeta(id: string, meta: { title?: string; slug?: string; seo?: StorePageDoc["seo"] }): Promise<StorePageDoc> {
  const p = await mine(id);
  if (meta.slug !== undefined && !PAGE_SLUG.test(meta.slug)) throw new ApiError("Use lowercase letters, numbers and dashes, like summer-sale.", "validation");
  const seo = meta.seo ? { title: meta.seo.title.slice(0, 70), description: meta.seo.description.slice(0, 160) } : p.seo;
  return save({ ...p, seo }, { title: meta.title?.trim() || undefined, slug: meta.slug || undefined });
}

export async function duplicateVisualPage(id: string): Promise<StorePageDoc> {
  const src = await mine(id);
  const title = `${src.title} (copy)`;
  const copy: StorePageDoc = { ...JSON.parse(JSON.stringify(src)), title, slug: await uniqueSlug(title), published: undefined, publishedAt: undefined, versions: [] };
  const r = await sb().from("custom_pages").insert({ store_id: await activeStoreId(), title: title.slice(0, 80), slug: copy.slug, layout: layoutOf(copy), status: "draft" }).select(COLS).single();
  if (r.error) fail(r.error, { conflict: "Another page already uses that address." });
  return docFrom(r.data as Row);
}

export async function deleteVisualPage(id: string): Promise<void> {
  const r = await sb().from("custom_pages").delete().eq("id", id);
  if (r.error) fail(r.error);
}

/* ------------------------------------------------------------------ */
/* Buyer                                                                */
/* ------------------------------------------------------------------ */

async function publicRow(storeSlug: string, pageSlug?: string) {
  const store = must(await sb().from("stores").select("id").eq("slug", storeSlug).maybeSingle(), { notFound: "Store" });
  let q = sb().from("custom_pages").select(COLS).eq("store_id", store.id).eq("status", "published");
  if (pageSlug) q = q.eq("slug", pageSlug);
  return q;
}

export async function getPublicVisualPage(storeSlug: string, pageSlug: string): Promise<{ title: string; seo: StorePageDoc["seo"]; doc: PageDoc; context: RenderContext }> {
  const rows = must(await publicRow(storeSlug, pageSlug)) as Row[];
  const p = rows[0] ? docFrom(rows[0]) : undefined;
  if (!p?.published) throw new ApiError("Page not found.", "not_found");
  return { title: p.title, seo: p.seo, doc: p.published, context: await renderContextFor(storeSlug) };
}

/** Published pages for a store's navigation and footer */
export async function getPublicVisualPageLinks(storeSlug: string): Promise<{ title: string; slug: string }[]> {
  const rows = must(await publicRow(storeSlug)) as Row[];
  return rows.map(docFrom).map((p) => ({ title: p.title, slug: p.slug }));
}
