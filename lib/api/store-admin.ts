import type { Bundle, Collection, Coupon, Deal, Question, Review, StoreDesign, StorePages } from "../types";
import { liveChange } from "./live/notify";
import * as live from "./live/catalog";
import * as liveStore from "./live/store";

/** Creator-side management of their own store's design, catalogue, offers and moderation. */

export const getStoreDesign = (): Promise<StoreDesign> => liveStore.getStoreDesign();
export const updateStoreDesign = (design: StoreDesign): Promise<StoreDesign> => liveChange(liveStore.updateStoreDesign(design));
export const getStorePages = (): Promise<StorePages> => liveStore.getStorePages();
export const updateStorePages = (pages: StorePages): Promise<StorePages> => liveChange(liveStore.updateStorePages(pages));

/* Collections ------------------------------------------------------------ */

export const getCollections = (): Promise<Collection[]> => live.getCollections();
export const saveCollection = (c: Omit<Collection, "id" | "slug"> & { id?: string }): Promise<Collection[]> => liveChange(live.saveCollection(c));
export const deleteCollection = (id: string): Promise<Collection[]> => liveChange(live.deleteCollection(id));
export const moveCollection = (id: string, dir: -1 | 1): Promise<Collection[]> => liveChange(live.moveCollection(id, dir));

/* Offers ------------------------------------------------------------------ */

export interface Offers {
  coupons: Coupon[];
  bundles: Bundle[];
  /** Timed store-wide deals have no table yet: always empty, and the screen says "coming soon". */
  deals: Deal[];
}

export const getOffers = (): Promise<Offers> => live.getOffers();
export const saveCoupon = (c: Omit<Coupon, "id" | "used"> & { id?: string }): Promise<Offers> => liveChange(live.saveCoupon(c));
export const saveBundle = (b: Omit<Bundle, "id"> & { id?: string }): Promise<Offers> => liveChange(live.saveBundle(b));
export const saveDeal = (_dl: Omit<Deal, "id"> & { id?: string }): Promise<Offers> => live.saveDeal();

export function deleteOffer(kind: "coupon" | "bundle" | "deal", id: string): Promise<Offers> {
  if (kind === "coupon") return liveChange(live.deleteCoupon(id));
  if (kind === "bundle") return liveChange(live.deleteDealRule(id).then(() => live.getOffers()));
  return live.getOffers();
}

/* Reviews ---------------------------------------------------------------- */

export type InboxReview = Review & { productTitle: string };

export const getReviewsInbox = (): Promise<InboxReview[]> => live.getReviewsInbox();
export const replyToReview = (id: string, body: string): Promise<Review> => liveChange(live.replyToReview(id, body));
export const setReviewFlag = (id: string, flag: "pinned" | "hidden", value: boolean): Promise<Review> => liveChange(live.setReviewFlag(id, flag, value));

/* Questions --------------------------------------------------------------- */

export type InboxQuestion = Question & { productTitle: string; productSlug: string };

export const getQuestionsInbox = (): Promise<InboxQuestion[]> => live.getQuestionsInbox();
export const answerQuestion = (id: string, body: string): Promise<Question> => liveChange(live.answerQuestion(id, body));
export const setQuestionHidden = (id: string, hidden: boolean): Promise<Question> => live.setQuestionHidden(id, hidden);
