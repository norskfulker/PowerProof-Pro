import { commit, db } from "../mock/db";
import { slugify, uid } from "../mock/random";
import { pageDocSchema, PAGE_SLUG, type PageDoc, type StorePageDoc } from "../pages/schema";
import { PAGE_TEMPLATES, templateById } from "../pages/templates";
import { priceInfo, publicName, ratingSummary } from "../pricing";
import type { Collection, PriceInfo, Product, RatingSummary, Store, StoreTheme } from "../types";
import { ApiError, call, notFound } from "./client";
import { scopeBySlug } from "./scope";

/**
 * Visual store pages (Part 4C). Each page keeps a working draft (autosaved), the published
 * version buyers see, and up to 20 versions. Only published pages are public.
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

function mine(id: string): StorePageDoc {
  return db().visualPages.find((p) => p.id === id) ?? notFound("Page");
}

function validate(doc: PageDoc): PageDoc {
  const r = pageDocSchema.safeParse(doc);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new ApiError(`That page has a problem: ${i.message}`, "validation");
  }
  return r.data;
}

function uniqueSlug(base: string, except?: string): string {
  const taken = new Set(db().visualPages.filter((p) => p.id !== except).map((p) => p.slug));
  const root = slugify(base) || "page";
  let s = root;
  for (let i = 2; taken.has(s); i++) s = `${root}-${i}`;
  return s;
}

export function renderContextFor(storeSlug: string, now = Date.now()): RenderContext {
  const sc = scopeBySlug(storeSlug);
  const live = sc.products.filter((p) => p.status === "published");
  return {
    store: sc.store,
    theme: sc.design.theme,
    products: live.map((p) => ({ ...p, info: priceInfo(p, sc.deals, now), rating: ratingSummary(sc.reviews.filter((r) => r.productId === p.id)) })),
    collections: sc.collections,
    reviews: sc.reviews
      .filter((r) => !r.hidden && r.rating >= 4)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.helpful - a.helpful)
      .slice(0, 6)
      .map((r) => ({ id: r.id, title: r.title, body: r.body, author: publicName(r.author), rating: r.rating })),
  };
}

/* ------------------------------------------------------------------ */
/* Creator                                                              */
/* ------------------------------------------------------------------ */

export function getVisualPages(): Promise<VisualPageSummary[]> {
  return call(() => db().visualPages.map(summary).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
}

export function getVisualPage(id: string): Promise<{ page: StorePageDoc; context: RenderContext }> {
  return call(() => ({ page: mine(id), context: renderContextFor(db().store.slug) }));
}

export function getPageTemplates() {
  return PAGE_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
}

export function createVisualPage(input: { templateId: string; title: string }): Promise<StorePageDoc> {
  return call(() => {
    const title = input.title.trim();
    if (title.length < 2) throw new ApiError("Give the page a name.", "validation");
    const d = db();
    const live = d.products.filter((p) => p.status === "published");
    const doc = validate(
      templateById(input.templateId).build({
        storeName: d.store.name,
        ownerName: d.store.ownerName,
        slug: d.store.slug,
        products: live.map((p) => ({ id: p.id, title: p.title })),
        collections: d.collections.map((c) => ({ slug: c.slug, name: c.name })),
        brand: d.store.brandColor,
        accent: "#C9A24F",
        now: Date.now(),
      })
    );
    const page: StorePageDoc = {
      id: uid("vp"),
      title,
      slug: uniqueSlug(title),
      template: input.templateId,
      draft: doc,
      updatedAt: new Date().toISOString(),
      seo: { title: `${title} · ${d.store.name}`, description: d.store.tagline },
      versions: [],
    };
    commit((x) => x.visualPages.unshift(page));
    return page;
  });
}

/** Autosave. Fast, so typing feels instant; validates so a broken tree is never stored. */
export function saveVisualDraft(id: string, doc: PageDoc, meta?: { title?: string }): Promise<{ updatedAt: string; status: VisualPageStatus }> {
  return call(() => {
    const p = mine(id);
    const clean = validate(doc);
    commit(() => {
      p.draft = clean;
      if (meta?.title?.trim()) p.title = meta.title.trim().slice(0, 80);
      p.updatedAt = new Date().toISOString();
    });
    return { updatedAt: p.updatedAt, status: visualStatus(p) };
  }, { fast: true });
}

export function publishVisualPage(id: string): Promise<StorePageDoc> {
  return call(() => {
    const p = mine(id);
    const clean = validate(p.draft);
    commit(() => {
      const at = new Date().toISOString();
      p.published = clean;
      p.publishedAt = at;
      p.updatedAt = at;
      p.versions = [{ id: uid("pv"), at, label: "Published", doc: clean }, ...p.versions].slice(0, MAX_VERSIONS);
    });
    return p;
  });
}

/** Throws away unpublished changes: the draft goes back to what buyers see. */
export function discardVisualDraft(id: string): Promise<StorePageDoc> {
  return call(() => {
    const p = mine(id);
    if (!p.published) throw new ApiError("This page has never been published, so there's nothing to go back to.", "conflict");
    commit(() => {
      p.draft = p.published!;
      p.updatedAt = new Date().toISOString();
    });
    return p;
  });
}

/** Copies an old version into the draft. Buyers keep seeing the published page until you publish. */
export function restoreVisualVersion(id: string, versionId: string): Promise<StorePageDoc> {
  return call(() => {
    const p = mine(id);
    const v = p.versions.find((x) => x.id === versionId) ?? notFound("Version");
    commit(() => {
      p.draft = v.doc;
      p.updatedAt = new Date().toISOString();
    });
    return p;
  });
}

export function updateVisualPageMeta(id: string, meta: { title?: string; slug?: string; seo?: StorePageDoc["seo"] }): Promise<StorePageDoc> {
  return call(() => {
    const p = mine(id);
    if (meta.slug !== undefined && !PAGE_SLUG.test(meta.slug)) throw new ApiError("Use lowercase letters, numbers and dashes, like summer-sale.", "validation");
    if (meta.slug && db().visualPages.some((x) => x.id !== id && x.slug === meta.slug)) throw new ApiError("Another page already uses that address.", "conflict");
    commit(() => {
      if (meta.title?.trim()) p.title = meta.title.trim().slice(0, 80);
      if (meta.slug) p.slug = meta.slug;
      if (meta.seo) p.seo = { title: meta.seo.title.slice(0, 70), description: meta.seo.description.slice(0, 160) };
      p.updatedAt = new Date().toISOString();
    });
    return p;
  });
}

export function duplicateVisualPage(id: string): Promise<StorePageDoc> {
  return call(() => {
    const src = mine(id);
    const title = `${src.title} (copy)`;
    const copy: StorePageDoc = { ...JSON.parse(JSON.stringify(src)), id: uid("vp"), title, slug: uniqueSlug(title), published: undefined, publishedAt: undefined, versions: [], updatedAt: new Date().toISOString() };
    commit((x) => x.visualPages.unshift(copy));
    return copy;
  });
}

export function deleteVisualPage(id: string): Promise<void> {
  return call(() => {
    commit((d) => (d.visualPages = d.visualPages.filter((p) => p.id !== id)));
  });
}

/* ------------------------------------------------------------------ */
/* Buyer                                                                */
/* ------------------------------------------------------------------ */

export function getPublicVisualPage(storeSlug: string, pageSlug: string): Promise<{ title: string; seo: StorePageDoc["seo"]; doc: PageDoc; context: RenderContext }> {
  return call(() => {
    const sc = scopeBySlug(storeSlug);
    const p = sc.visualPages.find((x) => x.slug === pageSlug && x.published) ?? notFound("Page");
    return { title: p.title, seo: p.seo, doc: p.published!, context: renderContextFor(storeSlug) };
  });
}

/** Published pages for a store's navigation and footer */
export function getPublicVisualPageLinks(storeSlug: string): Promise<{ title: string; slug: string }[]> {
  return call(() => scopeBySlug(storeSlug).visualPages.filter((p) => p.published).map((p) => ({ title: p.title, slug: p.slug })), { fast: true });
}
