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

/* Public interactions that need the server (spam checks, emails) open later ---------------- */

const SOON = "This opens soon.";
export const reportReview = (_reviewId: string): Promise<void> => Promise.reject(new ApiError(SOON, "validation"));
export const reportQuestion = (_questionId: string): Promise<void> => Promise.reject(new ApiError(SOON, "validation"));
export const askQuestion = (_slug: string, _productId: string, _input: { name: string; email: string; body: string }): Promise<Question> => Promise.reject(new ApiError("Questions open soon. For now, write to the store's support email.", "validation"));
export const subscribeNewsletter = (_slug: string, _email: string): Promise<void> => Promise.reject(new ApiError("The newsletter opens soon.", "validation"));
export const sendContactMessage = (_slug: string, _input: { name: string; email: string; message: string }): Promise<void> => Promise.reject(new ApiError("The contact form opens soon. Write to the store's support email for now.", "validation"));
