import { commit } from "../mock/db";
import { uid } from "../mock/random";
import { publicName } from "../pricing";
import type { Company, InvoiceSettings, Order, Product, Question, Review, Store, StoreDesign, TaxCode } from "../types";
import { ApiError, call, notFound } from "./client";
import { allScopes, findOrder } from "./scope";

/**
 * Buyer access without accounts. The order token (sent by email and shown on the success
 * page) is the key to downloads, reviews, refunds and buyer answers.
 */

export interface OrderAccess {
  order: Order;
  store: Store;
  design: StoreDesign;
  products: Product[];
  /** Products in this order the buyer hasn't reviewed yet */
  reviewable: string[];
  myReviews: Review[];
  questions: Question[];
}

function access(token: string): OrderAccess {
  const { scope, order } = findOrder((o) => o.token === token);
  const ids = [...new Set(order.items.map((i) => i.productId))];
  const myReviews = scope.reviews.filter((r) => r.orderId === order.id);
  return {
    order,
    store: scope.store,
    design: scope.design,
    products: ids.map((id) => scope.products.find((p) => p.id === id)).filter(Boolean) as Product[],
    reviewable: order.status === "paid" ? ids.filter((id) => !myReviews.some((r) => r.productId === id)) : [],
    myReviews,
    questions: scope.questions.filter((q) => ids.includes(q.productId) && !q.hidden),
  };
}

export function getOrderByToken(token: string): Promise<OrderAccess> {
  return call(() => access(token));
}

/** For the success page, which is reached right after paying (by order id). */
export function getOrderForSuccess(orderId: string): Promise<OrderAccess> {
  return call(() => access(findOrder((o) => o.id === orderId).order.token));
}

export function recordDownload(token: string): Promise<void> {
  return call(() => commit(() => (findOrder((o) => o.token === token).order.downloads += 1)), { fast: true });
}

export interface ReviewInput {
  productId: string;
  rating: Review["rating"];
  title: string;
  body: string;
  photos: Review["photos"];
}

export function submitReview(token: string, input: ReviewInput): Promise<Review> {
  return call(() => {
    const { scope, order } = findOrder((o) => o.token === token);
    if (order.status !== "paid") throw new ApiError("Reviews open once an order is paid and not refunded.", "conflict");
    if (!order.items.some((i) => i.productId === input.productId)) throw new ApiError("You can only review what you bought.", "validation");
    if (scope.reviews.some((r) => r.orderId === order.id && r.productId === input.productId)) throw new ApiError("You've already reviewed this one. Thank you!", "conflict");
    if (input.body.trim().length < 10) throw new ApiError("Write a sentence or two so others know what you thought.", "validation");
    const review: Review = {
      id: uid("rv"),
      productId: input.productId,
      orderId: order.id,
      rating: input.rating,
      title: input.title.trim() || "Verified purchase",
      body: input.body.trim(),
      photos: input.photos.slice(0, 3),
      author: publicName(order.buyerName),
      createdAt: new Date().toISOString(),
      helpful: 0,
      verified: true,
      imported: false,
      pinned: false,
      hidden: false,
      reported: false,
    };
    commit(() => {
      scope.reviews.unshift(review);
      order.reviewed = true;
    });
    return review;
  });
}

export function answerAsBuyer(token: string, questionId: string, body: string): Promise<Question> {
  return call(() => {
    const { scope, order } = findOrder((o) => o.token === token);
    const q = scope.questions.find((x) => x.id === questionId) ?? notFound("Question");
    if (!order.items.some((i) => i.productId === q.productId) || order.status !== "paid") throw new ApiError("Only people who bought this can answer.", "conflict");
    if (body.trim().length < 3) throw new ApiError("Write an answer first.", "validation");
    commit(() => q.answers.push({ id: uid("an"), author: `${publicName(order.buyerName)} · Verified buyer`, role: "buyer", body: body.trim(), createdAt: new Date().toISOString() }));
    return q;
  });
}

export function requestRefund(token: string, reason: string): Promise<Order> {
  return call(() => {
    const { order } = findOrder((o) => o.token === token);
    if (order.status !== "paid") throw new ApiError("This order can't be refunded from here. Write to the creator instead.", "conflict");
    commit(() => {
      order.status = "refund_requested";
      order.refundReason = reason;
    });
    return order;
  });
}

/**
 * Lookup never reveals orders on screen in production: it emails a fresh link.
 * The mock returns the link too so the demo can follow it.
 */
export function lookupOrder(email: string, number: string): Promise<{ sentTo: string; demoToken?: string }> {
  return call(() => {
    const e = email.trim().toLowerCase();
    const n = number.trim().toUpperCase();
    for (const s of allScopes()) {
      const o = s.orders.find((x) => x.buyerEmail === e && x.number === n && x.status !== "pending" && x.status !== "failed");
      if (o) return { sentTo: e, demoToken: o.token };
    }
    // Same answer either way, so nobody can probe which emails bought what.
    return { sentTo: e };
  });
}

export interface InvoiceData {
  order: Order;
  store: Store;
  company: Company;
  settings: InvoiceSettings;
  taxCode?: TaxCode;
  sku?: string;
}

export function getInvoice(orderId: string): Promise<InvoiceData> {
  return call(() => {
    const { scope, order } = findOrder((o) => o.id === orderId || o.token === orderId);
    if (!order.invoiceNumber) throw new ApiError("Invoices are issued once an order is paid.", "conflict");
    const product = scope.products.find((p) => p.id === order.productId);
    return {
      order,
      store: scope.store,
      company: scope.company,
      settings: scope.invoice,
      taxCode: scope.taxCodes.find((t) => t.code === (product?.taxCode ?? scope.invoice.defaultTaxCode)),
      sku: product?.sku,
    };
  });
}
