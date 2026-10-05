import { fromMajor } from "@/lib/money";
import { seedDb } from "@/lib/mock/seed";
import { STRESS } from "@/lib/mock/stress";
import { priceInfo, ratingSummary } from "@/lib/pricing";
import type { CardProduct } from "@/components/pp/store-product-card";

/** Real seeded data at a fixed instant, so component tests use the same shapes the screens do. */
export const NOW = Date.parse("2026-10-05T05:30:00Z");
export const DB = seedDb(NOW);
export const PRODUCT = DB.products[0];
export const ORDER = DB.orders.find((o) => o.status === "paid")!;
export const REVIEW = DB.reviews.find((r) => r.reply)!;
export const QUESTION = DB.questions.find((q) => q.answers.length > 0)!;
export const COUPON = DB.coupons[0];
export const COLLECTION = DB.collections[0];

export const card = (over: Partial<CardProduct> = {}): CardProduct => ({
  ...PRODUCT,
  info: priceInfo(PRODUCT, DB.deals, NOW),
  rating: ratingSummary(DB.reviews.filter((r) => r.productId === PRODUCT.id)),
  ...over,
});

export const LONG = STRESS;
export const INR = (n: number) => fromMajor(n);
