import { commit } from "../mock/db";
import type { StoreScope } from "../mock/base";
import { uid } from "../mock/random";
import { bundleTotals, isDealLive, priceInfo, ratingSummary } from "../pricing";
import type {
  Bundle,
  Collection,
  Coupon,
  Deal,
  Money,
  Page,
  PriceInfo,
  Product,
  Question,
  RatingSummary,
  Review,
  Store,
  StoreDesign,
  StorePages,
} from "../types";
import { ApiError, call, notFound } from "./client";
import { allScopes, scopeBySlug } from "./scope";

export interface StoreProduct extends Product {
  info: PriceInfo;
  rating: RatingSummary;
}

export interface BundleView {
  bundle: Bundle;
  products: StoreProduct[];
  full: Money;
  price: Money;
  percentOff: number;
}

export interface StorefrontView {
  store: Store;
  design: StoreDesign;
  pages: StorePages;
  products: StoreProduct[];
  collections: Collection[];
  coupons: Coupon[];
  bundles: BundleView[];
  deal?: Deal;
  rating: RatingSummary;
  totalSales: number;
  topReviews: (Review & { productTitle: string; productSlug: string })[];
}

function view(scope: StoreScope, now = Date.now()): StorefrontView {
  const live = scope.products.filter((p) => p.status === "published");
  const products: StoreProduct[] = live.map((p) => ({
    ...p,
    info: priceInfo(p, scope.deals, now),
    rating: ratingSummary(scope.reviews.filter((r) => r.productId === p.id)),
  }));
  const byId = new Map(products.map((p) => [p.id, p]));
  const visibleReviews = scope.reviews.filter((r) => !r.hidden && byId.has(r.productId));
  return {
    store: scope.store,
    design: scope.design,
    pages: scope.storePages,
    products,
    collections: scope.collections
      .map((c) => ({ ...c, productIds: c.productIds.filter((id) => byId.has(id)) }))
      .filter((c) => c.productIds.length > 0),
    coupons: scope.coupons.filter((c) => c.active && (!c.expiresAt || Date.parse(c.expiresAt) > now) && (c.usageLimit === undefined || c.used < c.usageLimit)),
    bundles: scope.bundles
      .filter((b) => b.active && b.productIds.every((id) => byId.has(id)))
      .map((b) => ({ bundle: b, products: b.productIds.map((id) => byId.get(id)!), ...bundleTotals(b, live, scope.deals) })),
    deal: scope.deals.find((d) => isDealLive(d, now)),
    rating: ratingSummary(visibleReviews),
    totalSales: live.reduce((t, p) => t + p.salesCount, 0),
    topReviews: visibleReviews
      .filter((r) => r.rating >= 4)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.helpful - a.helpful)
      .slice(0, 6)
      .map((r) => ({ ...r, productTitle: byId.get(r.productId)!.title, productSlug: byId.get(r.productId)!.slug })),
  };
}

export function getStorefront(slug: string): Promise<StorefrontView> {
  return call(() => view(scopeBySlug(slug)));
}

/** Design preview: the same view with a draft design swapped in. */
export function previewStorefront(slug: string, design: StoreDesign): Promise<StorefrontView> {
  return call(() => ({ ...view(scopeBySlug(slug)), design }), { fast: true });
}

export interface ProductView {
  view: StorefrontView;
  product: StoreProduct;
  reviews: Review[];
  questions: Question[];
  related: StoreProduct[];
  bundles: BundleView[];
  page?: Page;
}

export function getStoreProduct(slug: string, productSlug: string): Promise<ProductView> {
  return call(() => {
    const scope = scopeBySlug(slug);
    const v = view(scope);
    const product = v.products.find((p) => p.slug === productSlug) ?? notFound("Product");
    const sameCollection = new Set(v.collections.filter((c) => c.productIds.includes(product.id)).flatMap((c) => c.productIds));
    const related = [...v.products.filter((p) => p.id !== product.id && sameCollection.has(p.id)), ...v.products.filter((p) => p.id !== product.id && !sameCollection.has(p.id))].slice(0, 4);
    // Only the creator's own store has custom pages
    const page = "pages" in scope ? (scope as { pages: Page[] }).pages.find((pg) => pg.status === "live" && pg.productIds.includes(product.id)) : undefined;
    return {
      view: v,
      product,
      reviews: scope.reviews.filter((r) => r.productId === product.id && !r.hidden),
      questions: scope.questions.filter((q) => q.productId === product.id && !q.hidden),
      related,
      bundles: v.bundles.filter((b) => b.bundle.productIds.includes(product.id)),
      page,
    };
  });
}

/* Public interactions ------------------------------------------------ */

function findReview(id: string): Review {
  for (const s of allScopes()) {
    const r = s.reviews.find((x) => x.id === id);
    if (r) return r;
  }
  return notFound("Review");
}

function findQuestion(id: string): Question {
  for (const s of allScopes()) {
    const q = s.questions.find((x) => x.id === id);
    if (q) return q;
  }
  return notFound("Question");
}

export function voteHelpful(reviewId: string): Promise<number> {
  return call(() => {
    const r = findReview(reviewId);
    commit(() => (r.helpful += 1));
    return r.helpful;
  }, { fast: true });
}

export function reportReview(reviewId: string): Promise<void> {
  return call(() => commit(() => (findReview(reviewId).reported = true)), { fast: true });
}

export function reportQuestion(questionId: string): Promise<void> {
  return call(() => commit(() => (findQuestion(questionId).reported = true)), { fast: true });
}

export function askQuestion(slug: string, productId: string, input: { name: string; email: string; body: string }): Promise<Question> {
  return call(() => {
    const scope = scopeBySlug(slug);
    if (input.body.trim().length < 8) throw new ApiError("Ask a full question so the creator can help.", "validation");
    const q: Question = {
      id: uid("qn"),
      productId,
      asker: input.name.trim().split(/\s+/)[0],
      askerEmail: input.email.trim().toLowerCase(),
      body: input.body.trim(),
      createdAt: new Date().toISOString(),
      answers: [],
      hidden: false,
      reported: false,
    };
    commit(() => scope.questions.unshift(q));
    return q;
  });
}

export function subscribeNewsletter(slug: string, email: string): Promise<void> {
  return call(() => {
    const scope = scopeBySlug(slug);
    const e = email.trim().toLowerCase();
    if (scope.subscribers.includes(e)) throw new ApiError("You're already on the list. Nice.", "conflict");
    commit(() => scope.subscribers.push(e));
  });
}

export function sendContactMessage(slug: string, input: { name: string; email: string; message: string }): Promise<void> {
  return call(() => {
    scopeBySlug(slug);
    if (input.message.trim().length < 10) throw new ApiError("Tell us a little more so we can help.", "validation");
  });
}
