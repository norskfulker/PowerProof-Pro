import type { Json } from "../database.types";
import { pageDocSchema, PAGE_SLUG, type PageDoc, type PageVersion, type StorePageDoc } from "../pages/schema";
import type { AiBrief, AiEvent } from "../pages/ai";
import type { SiteDraft } from "../pages/editor-store";
export type { SiteDraft };
import { HOME_TEMPLATE, PAGE_TEMPLATES, homeDocFrom, templateById, upgradeHomeDoc } from "../pages/templates";
import { publicName } from "../pricing";
import { slugify } from "../slug";
import { sb } from "../supabase/browser";
import type { AboutContent, Collection, FaqItem, PriceInfo, Product, RatingSummary, Store, StoreTheme } from "../types";
import { ApiError } from "./client";
import { getCollections, getProducts } from "./live/catalog";
import { fail, must } from "./live/errors";
import { writeProgress } from "./live/flags";
import { activeStoreId } from "./live/session";
import { load } from "./live/storefront";
import { getStore, getStoreDesign, updateStore, updateStoreDesign } from "./live/store";
import type { BundleView, StorefrontView } from "./storefront";

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
  /** The store's home page (it can't be renamed, moved or deleted) */
  home?: boolean;
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
  bundles: BundleView[];
  about: AboutContent;
  faq: FaqItem[];
  rating: RatingSummary;
}

const MAX_VERSIONS = 20;
const same = (a?: PageDoc, b?: PageDoc) => JSON.stringify(a) === JSON.stringify(b);

export function visualStatus(p: StorePageDoc): VisualPageStatus {
  if (!p.published) return "draft";
  return same(p.draft, p.published) ? "published" : "changed";
}

function summary(p: StorePageDoc): VisualPageSummary {
  return { id: p.id, title: p.title, slug: p.slug, template: p.template, status: visualStatus(p), updatedAt: p.updatedAt, publishedAt: p.publishedAt, sections: p.draft.blocks.length, ...(p.template === HOME_TEMPLATE ? { home: true } : {}) };
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
  focus?: boolean;
  published?: PageDoc;
  publishedAt?: string;
  seo: StorePageDoc["seo"];
  versions: PageVersion[];
  /** Pages saved before `sections` existed */
  draft?: PageDoc;
  /** Home only: store-wide settings changed in the editor and not yet published */
  site?: SiteDraft;
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
const KIND: Record<string, string> = { home: HOME_TEMPLATE, launch: "launch", sale: "sale", bio: "bio", link_in_bio: "bio", blank: "blank", lead: "lead", squeeze: "squeeze", booking: "booking", clickthrough: "clickthrough" };

function docFrom(r: Row): StorePageDoc {
  const l = r.layout as unknown as Layout;
  const home = l.template === HOME_TEMPLATE;
  const read: PageDoc = l.draft ?? { version: 1, blocks: l.sections ?? [], ...(l.style ? { style: l.style } : {}), ...(l.focus ? { focus: true } : {}) };
  const draft = home ? upgradeHomeDoc(read) : read;
  if (home && l.published) l.published = upgradeHomeDoc(l.published);
  return { id: r.id, title: r.title, slug: r.slug, template: KIND[l.template] ?? "blank", draft, published: l.published, publishedAt: l.publishedAt, updatedAt: r.updated_at, seo: l.seo, versions: l.versions ?? [], ...(l.site ? { site: l.site } : {}) };
}

const json = (v: unknown): Json => JSON.parse(JSON.stringify(v)) as Json;
const layoutOf = (p: StorePageDoc): Json => json({ ...publicPart(p), ...privatePart(p) } satisfies Layout);

/** What buyers may read once a page is published: custom_pages.layout */
function publicPart(p: StorePageDoc) {
  return { template: p.template, published: p.published, publishedAt: p.publishedAt, seo: p.seo };
}

/** The owner's work in progress: custom_page_drafts.data (migration 031) */
function privatePart(p: StorePageDoc) {
  return { sections: p.draft.blocks, ...(p.draft.style ? { style: p.draft.style } : {}), ...(p.draft.focus ? { focus: true } : {}), versions: p.versions, ...(p.site ? { site: p.site } : {}) };
}

/**
 * Drafts live in their own owner-only table. Until migration 031 is applied it doesn't exist, and
 * everything stays in layout as before.
 */
let draftsTable: boolean | undefined;
const missingTable = (e: { code?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205");

/** Rows with their drafts folded back into layout, so docFrom sees the whole page */
async function withDrafts(rows: Row[]): Promise<Row[]> {
  if (!rows.length || draftsTable === false) return rows;
  const r = await sb().from("custom_page_drafts").select("page_id, data").in("page_id", rows.map((x) => x.id));
  if (missingTable(r.error)) {
    draftsTable = false;
    return rows;
  }
  if (r.error) fail(r.error);
  draftsTable = true;
  const by = new Map((r.data ?? []).map((d) => [d.page_id as string, d.data as Record<string, unknown>]));
  return rows.map((x) => (by.has(x.id) ? { ...x, layout: { ...(x.layout as Record<string, unknown>), ...by.get(x.id) } as Json } : x));
}

/** Writes a page's private part; false when the drafts table isn't there yet */
async function writeDraft(p: StorePageDoc, storeId: string): Promise<boolean> {
  if (draftsTable === false) return false;
  const r = await sb().from("custom_page_drafts").upsert({ page_id: p.id, store_id: storeId, data: json(privatePart(p)), updated_at: new Date().toISOString() });
  if (missingTable(r.error)) return (draftsTable = false);
  if (r.error) fail(r.error);
  draftsTable = true;
  return true;
}

async function mine(id: string): Promise<StorePageDoc> {
  const row = must(await sb().from("custom_pages").select(COLS).eq("id", id).single(), { notFound: "Page" }) as Row;
  return docFrom((await withDrafts([row]))[0]);
}

async function save(p: StorePageDoc, extra: { title?: string; slug?: string } = {}): Promise<StorePageDoc> {
  const storeId = await activeStoreId();
  const separate = await writeDraft(p, storeId);
  const r = await sb()
    .from("custom_pages")
    .update({ layout: separate ? json(publicPart(p)) : layoutOf(p), status: p.published ? "published" : "draft", title: (extra.title ?? p.title).slice(0, 80), ...(extra.slug ? { slug: extra.slug } : {}) })
    .eq("id", p.id)
    .select(COLS)
    .single();
  if (r.error) fail(r.error, { conflict: "Another page already uses that address.", notFound: "Page" });
  const row = r.data as Row;
  return docFrom(separate ? { ...row, layout: layoutOf(p) } : row);
}

/** Adds a page: the public row, then its draft */
async function insertPage(p: StorePageDoc, storeId: string, extra: { sort_order?: number } = {}): Promise<StorePageDoc> {
  const r = await sb()
    .from("custom_pages")
    .insert({ store_id: storeId, title: p.title.slice(0, 80), slug: p.slug, layout: layoutOf(p), status: "draft", ...extra })
    .select(COLS)
    .single();
  if (r.error) fail(r.error, { conflict: "Another page already uses that address." });
  const row = r.data as Row;
  const made = docFrom(row);
  // Move the private part out of the public column straight away
  if (await writeDraft({ ...p, id: row.id }, storeId)) await sb().from("custom_pages").update({ layout: json(publicPart(p)) }).eq("id", row.id);
  return { ...made, draft: p.draft, versions: p.versions, ...(p.site ? { site: p.site } : {}) };
}

async function uniqueSlug(base: string, except?: string): Promise<string> {
  const { data } = await sb().from("custom_pages").select("id, slug").eq("store_id", await activeStoreId());
  // "home" is the store's home page
  const taken = new Set([HOME_PAGE_SLUG, ...(data ?? []).filter((p) => p.id !== except).map((p) => String(p.slug))]);
  const root = slugify(base) || "page";
  let s = root;
  for (let i = 2; taken.has(s); i++) s = `${root}-${i}`;
  return s;
}

/** What a page needs to draw products, collections and reviews: the store as a buyer sees it. */
export async function renderContextFor(storeSlug: string): Promise<RenderContext> {
  return contextFromView((await load(storeSlug)).view);
}

/** The render context from a storefront that is already loaded */
export function contextFromView(view: StorefrontView): RenderContext {
  return {
    store: view.store,
    theme: view.design.theme,
    products: view.products,
    collections: view.collections,
    reviews: view.topReviews.map((r) => ({ id: r.id, title: r.title, body: r.body, author: publicName(r.author), rating: r.rating })),
    bundles: view.bundles,
    about: view.design.about,
    faq: view.pages.faq,
    rating: view.rating,
  };
}

/* ------------------------------------------------------------------ */
/* Creator                                                              */
/* ------------------------------------------------------------------ */

/** The page at a store's home address. */
export const HOME_PAGE_SLUG = "home";

/** Every page, the home page first */
export async function getVisualPages(): Promise<VisualPageSummary[]> {
  const rows = await withDrafts(must(await sb().from("custom_pages").select(COLS).eq("store_id", await activeStoreId())) as Row[]);
  return rows.map(docFrom).map(summary).sort((a, b) => Number(!!b.home) - Number(!!a.home) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function getVisualPage(id: string): Promise<{ page: StorePageDoc; context: RenderContext }> {
  const [page, store] = await Promise.all([mine(id), getStore()]);
  return { page, context: await renderContextFor(store.slug) };
}

export function getPageTemplates() {
  return PAGE_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
}


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
  return insertPage(page, await activeStoreId());
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
  if (p.template === HOME_TEMPLATE && meta.slug !== undefined && meta.slug !== HOME_PAGE_SLUG) throw new ApiError("The home page always lives at your store's address.", "validation");
  if (p.template !== HOME_TEMPLATE && meta.slug === HOME_PAGE_SLUG) throw new ApiError("\"home\" is your home page's address. Pick another.", "validation");
  if (meta.slug !== undefined && !PAGE_SLUG.test(meta.slug)) throw new ApiError("Use lowercase letters, numbers and dashes, like summer-sale.", "validation");
  const seo = meta.seo ? { title: meta.seo.title.slice(0, 70), description: meta.seo.description.slice(0, 160) } : p.seo;
  return save({ ...p, seo }, { title: meta.title?.trim() || undefined, slug: meta.slug || undefined });
}

export async function duplicateVisualPage(id: string): Promise<StorePageDoc> {
  const src = await mine(id);
  if (src.template === HOME_TEMPLATE) {
    src.template = "blank";
    delete src.site;
  }
  const title = `${src.title} (copy)`;
  const copy: StorePageDoc = { ...JSON.parse(JSON.stringify(src)), title, slug: await uniqueSlug(title), published: undefined, publishedAt: undefined, versions: [] };
  return insertPage(copy, await activeStoreId());
}

export async function deleteVisualPage(id: string): Promise<void> {
  if ((await mine(id)).template === HOME_TEMPLATE) throw new ApiError("The home page can't be deleted.", "validation");
  const r = await sb().from("custom_pages").delete().eq("id", id);
  if (r.error) fail(r.error);
}

/* ------------------------------------------------------------------ */
/* The editor: one page plus the store-wide settings                    */
/* ------------------------------------------------------------------ */

export interface EditorSession {
  page: StorePageDoc;
  context: RenderContext;
  /** The store-wide settings as the editor starts with them: the unpublished draft, else what's live */
  site: SiteDraft;
  /** What buyers see now, to tell whether the site settings have unpublished changes */
  liveSite: SiteDraft;
  /** Every page, for the page switcher */
  pages: VisualPageSummary[];
  /** The store is visible to buyers */
  storeLive: boolean;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The store's home page, made from its current home layout the first time. A page that already
 * uses the address "home" is moved to "home-2" first.
 */
async function ensureHome(): Promise<StorePageDoc> {
  const storeId = await activeStoreId();
  const rows = await withDrafts(must(await sb().from("custom_pages").select(COLS).eq("store_id", storeId)) as Row[]);
  const pages = rows.map(docFrom);
  const home = pages.find((p) => p.template === HOME_TEMPLATE);
  if (home) return home;
  const squatter = pages.find((p) => p.slug === HOME_PAGE_SLUG);
  if (squatter) await save(squatter, { slug: await uniqueSlug("home-2", squatter.id) });
  const [store, design, products] = await Promise.all([getStore(), getStoreDesign(), getProducts()]);
  const doc = validate(homeDocFrom(design, store.slug, products.filter((p) => p.status === "published").map((p) => p.id)));
  const page: StorePageDoc = { id: "", title: "Home page", slug: HOME_PAGE_SLUG, template: HOME_TEMPLATE, draft: doc, updatedAt: new Date().toISOString(), seo: { title: design.seo.title, description: design.seo.description }, versions: [] };
  return insertPage(page, storeId, { sort_order: -1 });
}

/** The home page row, without making one */
async function findHome(): Promise<StorePageDoc | undefined> {
  const rows = await withDrafts(must(await sb().from("custom_pages").select(COLS).eq("store_id", await activeStoreId()).eq("slug", HOME_PAGE_SLUG)) as Row[]);
  return rows.map(docFrom).find((p) => p.template === HOME_TEMPLATE);
}

/** Opens a page in the editor. `id` is a page id, or "home" for the store's home page. */
export async function getEditorSession(id: string): Promise<EditorSession> {
  const page = id === HOME_PAGE_SLUG ? await ensureHome() : await mine(id);
  const [store, design, home] = await Promise.all([getStore(), getStoreDesign(), page.template === HOME_TEMPLATE ? page : findHome()]);
  const liveSite: SiteDraft = { design, logo: store.logo };
  const [context, pages] = await Promise.all([renderContextFor(store.slug), getVisualPages()]);
  return { page, context, site: home?.site ?? liveSite, liveSite, pages, storeLive: store.onboarded };
}

/**
 * Autosave for the editor: the page's draft, and the store-wide settings (kept on the home page
 * until they're published). Pass `site` only when it changed.
 */
export async function saveEditorDraft(id: string, doc: PageDoc, site?: SiteDraft): Promise<{ updatedAt: string; status: VisualPageStatus }> {
  const p = await mine(id);
  const clean = validate(doc);
  if (site && p.template !== HOME_TEMPLATE) {
    const home = await ensureHome();
    await save({ ...home, site });
  }
  const saved = await save({ ...p, draft: clean, ...(site && p.template === HOME_TEMPLATE ? { site } : {}) });
  return { updatedAt: saved.updatedAt, status: visualStatus(saved) };
}

/** Puts the store-wide settings live: the look on stores.theme, brand colour and logo on their columns */
async function publishSite(site: SiteDraft): Promise<void> {
  const [store, design] = await Promise.all([getStore(), getStoreDesign()]);
  if (!sameJson({ brand: site.design.theme.brand, logo: site.logo }, { brand: store.brandColor, logo: store.logo })) await updateStore({ brandColor: site.design.theme.brand ?? store.brandColor, logo: site.logo });
  if (!sameJson(site.design, design)) await updateStoreDesign(site.design);
}

/**
 * Publish from the editor: the store-wide settings (when changed) and this page. With `goLive`,
 * the store also becomes visible to buyers.
 */
export async function publishEditor(id: string, opts: { site?: SiteDraft; goLive?: boolean } = {}): Promise<StorePageDoc> {
  const home = await findHome();
  const site = opts.site ?? home?.site;
  if (site) await publishSite(site);
  // The site draft is live now: clear it so the editor starts from what buyers see
  if (home?.site) await save({ ...home, site: undefined });
  const before = await mine(id);
  const page = await publishVisualPage(id);
  // Getting started: publishing a changed home page counts as making the hero your own
  if (page.template === HOME_TEMPLATE && !sameJson(before.published, page.published)) writeProgress((p) => ({ customized: { ...p.customized, hero: true } }));
  if (opts.goLive) await updateStore({ onboarded: true });
  return page;
}

/** Throws away unpublished changes to this page and to the store-wide settings */
export async function discardEditorDraft(id: string): Promise<{ page: StorePageDoc; site: SiteDraft }> {
  const home = await findHome();
  if (home?.site) await save({ ...home, site: undefined });
  const p = await mine(id);
  const page = p.published ? await save({ ...p, draft: p.published, site: undefined }) : p;
  const [store, design] = await Promise.all([getStore(), getStoreDesign()]);
  return { page, site: { design, logo: store.logo } };
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
  return rows.map(docFrom).filter((p) => p.template !== HOME_TEMPLATE).map((p) => ({ title: p.title, slug: p.slug }));
}

/* ------------------------------------------------------------------ */
/* AI page builder                                                      */
/* ------------------------------------------------------------------ */

/** Whether AI is connected, and today's use of the plan's AI pages */
export async function getAiPageAllowance(): Promise<{ connected: boolean; used: number; daily: number }> {
  const r = await fetch("/api/ai/page", { cache: "no-store" });
  const body = (await r.json().catch(() => null)) as { connected?: boolean; used?: number; daily?: number; message?: string } | null;
  if (!r.ok || !body) throw new ApiError(body?.message ?? "Couldn't check your AI allowance.", "network");
  return { connected: !!body.connected, used: body.used ?? 0, daily: body.daily ?? 0 };
}

/**
 * Asks AI to build the page. Calls `onEvent` for each step as it streams in (sections arrive one
 * by one). Resolves when the build ends; throws ApiError when it can't start (limit, not connected).
 */
export async function buildPageWithAi(pageId: string, brief: AiBrief, onEvent: (e: AiEvent) => void, signal?: AbortSignal): Promise<void> {
  const r = await fetch("/api/ai/page", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pageId, brief }), signal });
  if (!r.ok || !r.body) {
    const body = (await r.json().catch(() => null)) as { message?: string; code?: string } | null;
    throw new ApiError(body?.message ?? "AI couldn't start. Try again.", r.status === 429 ? "conflict" : r.status === 400 ? "validation" : "network");
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as AiEvent);
    }
  }
}

/** Keeps a copy of the page under a name in its versions (newest first, at most 20) */
export async function addVisualVersion(id: string, doc: PageDoc, label: string): Promise<void> {
  const p = await mine(id);
  const version: PageVersion = { id: `pv_${Date.now().toString(36)}`, at: new Date().toISOString(), label: label.slice(0, 60), doc: validate(doc) };
  await save({ ...p, versions: [version, ...p.versions].slice(0, MAX_VERSIONS) });
}
