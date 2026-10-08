import { sb } from "../supabase/browser";
import { questionFrom } from "./live/map";
import { submitLead } from "./leads";
import type { Rates } from "../fx";
import type { Bundle, Collection, Money, PriceInfo, Product, Question, RatingSummary, Review, Store, StoreDesign, StorePages } from "../types";
import { ApiError } from "./client";
import * as live from "./live/storefront";

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
  bundles: BundleView[];
  rating: RatingSummary;
  topReviews: (Review & { productTitle: string; productSlug: string })[];
  /** Published visual pages, for the footer */
  extraPages: { title: string; slug: string }[];
  /** Units per US dollar, for showing prices in another currency. Empty until rates are loaded into the database. */
  rates?: Rates;
}

export const getStorefront = (slug: string): Promise<StorefrontView> => live.getStorefront(slug);
/** Design preview: the same view with a draft design swapped in. */
export const previewStorefront = (slug: string, design: StoreDesign): Promise<StorefrontView> => live.previewStorefront(slug, design);

export interface ProductView {
  view: StorefrontView;
  product: StoreProduct;
  reviews: Review[];
  questions: Question[];
  related: StoreProduct[];
  bundles: BundleView[];
}

export const getStoreProduct = (slug: string, productSlug: string): Promise<ProductView> => live.getStoreProduct(slug, productSlug);

/* Reports: straight to the database; report_content only accepts things a visitor could see, and PowerProof staff review them */

async function report(type: "review" | "question" | "product" | "store", id: string, reason: string): Promise<void> {
  const r = await sb().rpc("report_content" as never, { p_type: type, p_target: id, p_reason: reason, p_email: null } as never);
  if (r.error) throw new ApiError(r.error.message.includes("report_target_not_found") ? "That's no longer on the page." : "That didn't send. Please try again.", "validation");
}
export const reportReview = (reviewId: string): Promise<void> => report("review", reviewId, "Reported by a visitor");
export const reportQuestion = (questionId: string): Promise<void> => report("question", questionId, "Reported by a visitor");
export const reportProduct = (productId: string, reason: string): Promise<void> => report("product", productId, reason);
export const reportStore = (storeId: string, reason: string): Promise<void> => report("store", storeId, reason);
const QUESTION: Record<string, string> = {
  question_product_not_found: "That product isn't for sale right now.",
  question_invalid: "Add your name, a valid email and a question of at least a few words.",
  question_rate_limited: "You've asked a lot today. Please try again tomorrow.",
};
/** Straight to the database: ask_question checks the product is live and limits how many a day. */
export async function askQuestion(slug: string, productId: string, input: { name: string; email: string; body: string }): Promise<Question> {
  const r = await sb().rpc("ask_question", { p_store_slug: slug, p_product: productId, p_name: input.name, p_email: input.email, p_body: input.body });
  if (r.error || !r.data) {
    const key = Object.keys(QUESTION).find((k) => r.error?.message.includes(k));
    throw new ApiError(key ? QUESTION[key] : "That didn't send. Please try again.", "validation");
  }
  return questionFrom(r.data as unknown as Parameters<typeof questionFrom>[0], "");
}
/** A newsletter signup is saved as a lead of its own kind, one per address per store. */
export const subscribeNewsletter = (slug: string, email: string): Promise<void> => submitLead(slug, null, { kind: "newsletter", email });
/** The contact form is saved as a lead of its own kind, so it shows up under Sales › Leads. */
export const sendContactMessage = (slug: string, input: { name: string; email: string; message: string }): Promise<void> =>
  submitLead(slug, null, { kind: "contact", name: input.name, email: input.email, data: { Message: input.message } });
