import { cleanTags } from "../analytics-tags";
import type { OrderView } from "../server/order-types";
import { sb } from "../supabase/browser";
import { ApiError } from "./client";

/**
 * What a buyer does with an order, straight against the database (functions that check the link
 * token or the email and order number themselves). No custom web route is involved.
 */
export async function getPublicOrder(token: string): Promise<OrderView> {
  const r = await sb().rpc("get_order", { p_token: token });
  if (r.error) throw new ApiError("Orders can't be opened right now. Please try again in a few minutes.");
  if (!r.data) throw new ApiError("That link has expired or isn't valid. Look your order up with your email and order number.", "not_found");
  const o = r.data as unknown as OrderView;
  return { ...o, analytics: cleanTags(o.analytics) };
}

/** A fresh link for a paid order, from the email on it and its number. The same answer for every miss. */
export async function lookupOrder(email: string, ref: string): Promise<string> {
  const r = await sb().rpc("lookup_order", { p_email: email, p_ref: ref });
  if (r.error?.message.includes("lookup_rate_limited")) throw new ApiError("Too many tries for this order. Please wait an hour.", "validation");
  if (r.error) throw new ApiError("Order lookup isn't available right now. Please try again in a few minutes.");
  if (!r.data) throw new ApiError("We couldn't find a paid order with that email and number.", "not_found");
  return r.data;
}

const REVIEW: Record<string, string> = {
  review_link_invalid: "That order link has expired. Look your order up again.",
  review_not_in_order: "That product isn't part of this order.",
  review_exists: "You've already reviewed this. Thank you!",
  review_invalid: "Add your name, a valid email and a star rating.",
  review_rate_limited: "You've left a lot of reviews today. Please try again tomorrow.",
  review_product_not_found: "This product isn't taking reviews right now.",
};

/** A verified buyer's review; the link token is the proof of purchase. Returns false if it was already reviewed. */
export async function submitReview(token: string, productId: string, review: { rating: number; title?: string; body?: string }): Promise<boolean> {
  const r = await sb().rpc("submit_review", { p_token: token, p_product: productId, p_rating: review.rating, p_title: review.title ?? "", p_body: review.body ?? "" });
  if (!r.error) return true;
  if (r.error.message.includes("review_exists")) return false;
  const key = Object.keys(REVIEW).find((k) => r.error!.message.includes(k));
  throw new ApiError(key ? REVIEW[key] : "We couldn't save your review. Please try again.", "validation");
}

/**
 * A review from anyone, before or after buying. It is verified (and says so) when the email has a
 * paid order for the product; otherwise it becomes verified if that email buys it later.
 * Returns whether it is verified now.
 */
export async function submitOpenReview(storeSlug: string, productId: string, review: { name: string; email: string; rating: number; title?: string; body?: string }): Promise<boolean> {
  const r = await sb().rpc("submit_open_review", { p_store_slug: storeSlug, p_product: productId, p_name: review.name, p_email: review.email, p_rating: review.rating, p_title: review.title ?? "", p_body: review.body ?? "" });
  if (!r.error) return !!r.data;
  const key = Object.keys(REVIEW).find((k) => r.error!.message.includes(k));
  throw new ApiError(key ? REVIEW[key] : "We couldn't save your review. Please try again.", "validation");
}
