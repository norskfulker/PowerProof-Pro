import { commit, db } from "../mock/db";
import { writeProgress } from "../mock/progress";
import { slugify, uid } from "../mock/random";
import type { Bundle, Collection, Coupon, Deal, Question, Review, StoreDesign, StorePages } from "../types";
import { ApiError, call, notFound } from "./client";
import { isLive } from "../supabase/env";
import { liveChange } from "./live/notify";
import * as live from "./live/catalog";
import * as liveStore from "./live/store";

/** Creator-side management of their own store's design, catalogue, offers and moderation. */

export function getStoreDesign(): Promise<StoreDesign> {
  if (isLive()) return liveStore.getStoreDesign();
  return call(() => db().design);
}

export function updateStoreDesign(design: StoreDesign): Promise<StoreDesign> {
  if (isLive()) return liveChange(liveStore.updateStoreDesign(design));
  return call(() => {
    if (!design.hero.headline.trim()) throw new ApiError("The hero needs a headline.", "validation");
    const before = db().design;
    commit((d) => (d.design = design));
    // Getting started: note which parts of the store the creator has made their own
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    writeProgress((p) => ({
      customized: {
        hero: p.customized.hero || !same(before.hero, design.hero),
        colors: p.customized.colors || !same(before.theme, design.theme),
        about: p.customized.about || !same(before.about, design.about),
      },
    }));
    return db().design;
  });
}

export function getStorePages(): Promise<StorePages> {
  if (isLive()) return liveStore.getStorePages();
  return call(() => db().storePages);
}

export function updateStorePages(pages: StorePages): Promise<StorePages> {
  if (isLive()) return liveChange(liveStore.updateStorePages(pages));
  return call(() => {
    commit((d) => (d.storePages = pages));
    return db().storePages;
  });
}

/* Collections ------------------------------------------------------------ */

export function getCollections(): Promise<Collection[]> {
  if (isLive()) return live.getCollections();
  return call(() => db().collections);
}

export function saveCollection(c: Omit<Collection, "id" | "slug"> & { id?: string }): Promise<Collection[]> {
  if (isLive()) return liveChange(live.saveCollection(c));
  return call(() => {
    if (c.name.trim().length < 2) throw new ApiError("Name the collection.", "validation");
    if (c.productIds.length === 0) throw new ApiError("Pick at least one product.", "validation");
    commit((d) => {
      const existing = c.id && d.collections.find((x) => x.id === c.id);
      if (existing) Object.assign(existing, c, { slug: slugify(c.name) });
      else d.collections.push({ ...c, id: uid("col"), slug: slugify(c.name) });
    });
    return db().collections;
  });
}

export function deleteCollection(id: string): Promise<Collection[]> {
  if (isLive()) return liveChange(live.deleteCollection(id));
  return call(() => {
    commit((d) => (d.collections = d.collections.filter((c) => c.id !== id)));
    return db().collections;
  });
}

export function moveCollection(id: string, dir: -1 | 1): Promise<Collection[]> {
  if (isLive()) return liveChange(live.moveCollection(id, dir));
  return call(() => {
    commit((d) => {
      const i = d.collections.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.collections.length) return;
      [d.collections[i], d.collections[j]] = [d.collections[j], d.collections[i]];
    });
    return db().collections;
  }, { fast: true });
}

/* Offers ------------------------------------------------------------------ */

export interface Offers {
  coupons: Coupon[];
  bundles: Bundle[];
  deals: Deal[];
}

export function getOffers(): Promise<Offers> {
  if (isLive()) return live.getOffers();
  return call(() => ({ coupons: db().coupons, bundles: db().bundles, deals: db().deals }));
}

export function saveCoupon(c: Omit<Coupon, "id" | "used"> & { id?: string }): Promise<Offers> {
  if (isLive()) return liveChange(live.saveCoupon(c));
  return call(() => {
    const code = c.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new ApiError("Codes are 3 to 20 letters or numbers, no spaces.", "validation");
    if (c.kind === "percent" && (c.value < 1 || c.value > 90)) throw new ApiError("Percent off must be between 1 and 90.", "validation");
    if (c.kind === "fixed" && c.value < 100) throw new ApiError("Fixed discounts start at ₹1.00.", "validation");
    if (c.scope === "products" && c.productIds.length === 0) throw new ApiError("Pick the products this code works on.", "validation");
    const d = db();
    if (d.coupons.some((x) => x.code === code && x.id !== c.id)) throw new ApiError(`${code} already exists.`, "conflict");
    commit(() => {
      const existing = c.id && d.coupons.find((x) => x.id === c.id);
      if (existing) Object.assign(existing, c, { code });
      else d.coupons.unshift({ ...c, code, id: uid("cp"), used: 0 });
    });
    return getOffersSync();
  });
}

export function saveBundle(b: Omit<Bundle, "id"> & { id?: string }): Promise<Offers> {
  if (isLive()) return liveChange(live.saveBundle(b));
  return call(() => {
    if (b.name.trim().length < 2) throw new ApiError("Name the bundle.", "validation");
    if (b.productIds.length < 2 || b.productIds.length > 5) throw new ApiError("Bundles have 2 to 5 products.", "validation");
    if (b.pricing.kind === "percent" && (b.pricing.percent < 1 || b.pricing.percent > 90)) throw new ApiError("Percent off must be between 1 and 90.", "validation");
    commit((d) => {
      const existing = b.id && d.bundles.find((x) => x.id === b.id);
      if (existing) Object.assign(existing, b);
      else d.bundles.unshift({ ...b, id: uid("bd") });
    });
    return getOffersSync();
  });
}

export function saveDeal(dl: Omit<Deal, "id"> & { id?: string }): Promise<Offers> {
  if (isLive()) return live.saveDeal();
  return call(() => {
    if (Date.parse(dl.endsAt) <= Date.parse(dl.startsAt)) throw new ApiError("The deal has to end after it starts.", "validation");
    if (dl.percentOff < 1 || dl.percentOff > 90) throw new ApiError("Percent off must be between 1 and 90.", "validation");
    commit((d) => {
      const existing = dl.id && d.deals.find((x) => x.id === dl.id);
      if (existing) Object.assign(existing, dl);
      else d.deals.unshift({ ...dl, id: uid("dl") });
    });
    return getOffersSync();
  });
}

export function deleteOffer(kind: "coupon" | "bundle" | "deal", id: string): Promise<Offers> {
  if (isLive() && kind === "coupon") return liveChange(live.deleteCoupon(id));
  if (isLive() && kind === "bundle") return liveChange(live.deleteDealRule(id).then(() => live.getOffers()));
  return call(() => {
    commit((d) => {
      if (kind === "coupon") d.coupons = d.coupons.filter((x) => x.id !== id);
      if (kind === "bundle") d.bundles = d.bundles.filter((x) => x.id !== id);
      if (kind === "deal") d.deals = d.deals.filter((x) => x.id !== id);
    });
    return getOffersSync();
  });
}

function getOffersSync(): Offers {
  const d = db();
  return { coupons: d.coupons, bundles: d.bundles, deals: d.deals };
}

/* Reviews ---------------------------------------------------------------- */

export type InboxReview = Review & { productTitle: string };

export function getReviewsInbox(): Promise<InboxReview[]> {
  if (isLive()) return live.getReviewsInbox();
  return call(() => {
    const d = db();
    return d.reviews.map((r) => ({ ...r, productTitle: d.products.find((p) => p.id === r.productId)?.title ?? "Removed product" }));
  });
}

function myReview(id: string): Review {
  return db().reviews.find((r) => r.id === id) ?? notFound("Review");
}

export function replyToReview(id: string, body: string): Promise<Review> {
  if (isLive()) return liveChange(live.replyToReview(id, body));
  return call(() => {
    if (body.trim().length < 2) throw new ApiError("Write a reply first.", "validation");
    const r = myReview(id);
    commit(() => (r.reply = { body: body.trim(), createdAt: new Date().toISOString() }));
    return r;
  });
}

export function setReviewFlag(id: string, flag: "pinned" | "hidden", value: boolean): Promise<Review> {
  if (isLive()) return liveChange(live.setReviewFlag(id, flag, value));
  return call(() => {
    const d = db();
    const r = myReview(id);
    if (flag === "pinned" && value && d.reviews.filter((x) => x.pinned).length >= 3) {
      throw new ApiError("You can pin up to 3 reviews. Unpin one first.", "conflict");
    }
    commit(() => (r[flag] = value));
    return r;
  });
}

export function addImportedReview(input: { productId: string; author: string; rating: Review["rating"]; title: string; body: string }): Promise<Review> {
  if (isLive()) return live.addImportedReview(input);
  return call(() => {
    if (input.body.trim().length < 10) throw new ApiError("Paste the full testimonial.", "validation");
    const r: Review = { ...input, id: uid("rv"), photos: [], createdAt: new Date().toISOString(), helpful: 0, verified: false, imported: true, pinned: false, hidden: false, reported: false };
    commit((d) => d.reviews.unshift(r));
    return r;
  });
}

/* Questions --------------------------------------------------------------- */

export type InboxQuestion = Question & { productTitle: string; productSlug: string };

export function getQuestionsInbox(): Promise<InboxQuestion[]> {
  if (isLive()) return live.getQuestionsInbox();
  return call(() => {
    const d = db();
    return d.questions.map((q) => {
      const p = d.products.find((x) => x.id === q.productId);
      return { ...q, productTitle: p?.title ?? "Removed product", productSlug: p?.slug ?? "" };
    });
  });
}

export function answerQuestion(id: string, body: string): Promise<Question> {
  if (isLive()) return liveChange(live.answerQuestion(id, body));
  return call(() => {
    const d = db();
    const q = d.questions.find((x) => x.id === id) ?? notFound("Question");
    if (body.trim().length < 2) throw new ApiError("Write an answer first.", "validation");
    commit(() => q.answers.push({ id: uid("an"), author: d.store.ownerName.split(" ")[0], role: "creator", body: body.trim(), createdAt: new Date().toISOString() }));
    return q;
  });
}

export function setQuestionHidden(id: string, hidden: boolean): Promise<Question> {
  if (isLive()) return live.setQuestionHidden(id, hidden);
  return call(() => {
    const q = db().questions.find((x) => x.id === id) ?? notFound("Question");
    commit(() => (q.hidden = hidden));
    return q;
  });
}

export function getSubscribers(): Promise<string[]> {
  return call(() => db().subscribers);
}
