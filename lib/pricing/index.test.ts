import { describe, expect, it } from "vitest";
import { fromMajor, money } from "../money";
import type { Coupon, Deal, OrderItem, Product, Review } from "../types";
import { bundleTotals, checkCoupon, checkoutLines, includedGst, isDealLive, priceInfo, publicName, ratingSummary } from "./index";

const NOW = Date.parse("2026-10-05T05:30:00Z");
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();

const product = (id: string, major: number, compare?: number): Product =>
  ({ id, title: id, price: fromMajor(major), compareAt: compare ? fromMajor(compare) : undefined }) as Product;

const deal = (over: Partial<Deal> = {}): Deal =>
  ({ id: "d1", name: "Sale", percentOff: 20, productIds: [], startsAt: iso(NOW - DAY), endsAt: iso(NOW + DAY), ...over }) as Deal;

const coupon = (over: Partial<Coupon> = {}): Coupon => ({ id: "c", code: "SAVE", kind: "percent", value: 10, used: 0, scope: "store", productIds: [], active: true, ...over });

const item = (productId: string, major: number, kind: OrderItem["kind"] = "product"): OrderItem => ({ productId, title: productId, price: fromMajor(major), kind });

describe("store deals", () => {
  it("is live between start and end only", () => {
    expect(isDealLive(deal(), NOW)).toBe(true);
    expect(isDealLive(deal({ endsAt: iso(NOW) }), NOW)).toBe(false);
    expect(isDealLive(deal({ startsAt: iso(NOW + 1) }), NOW)).toBe(false);
  });

  it("applies a live deal over compare-at", () => {
    const info = priceInfo(product("p", 1000, 2000), [deal()], NOW);
    expect(info.price.amount).toBe(80000);
    expect(info.compareAt?.amount).toBe(100000);
    expect(info.percentOff).toBe(20);
  });

  it("only applies product-scoped deals to those products", () => {
    expect(priceInfo(product("p", 1000), [deal({ productIds: ["other"] })], NOW).price.amount).toBe(100000);
  });

  it("falls back to compare-at, and ignores a compare-at below the price", () => {
    expect(priceInfo(product("p", 750, 1000), [], NOW).percentOff).toBe(25);
    expect(priceInfo(product("p", 1000, 900), [], NOW).compareAt).toBeUndefined();
  });
});

describe("bundleTotals", () => {
  const ps = [product("a", 500), product("b", 1500)];
  it("prices by fixed price or percent", () => {
    expect(bundleTotals({ id: "b", name: "B", productIds: ["a", "b"], pricing: { kind: "price", price: fromMajor(1500) }, active: true }, ps, [])).toEqual({
      full: fromMajor(2000),
      price: fromMajor(1500),
      percentOff: 25,
    });
    expect(bundleTotals({ id: "b", name: "B", productIds: ["a", "b"], pricing: { kind: "percent", percent: 10 }, active: true }, ps, []).price).toEqual(fromMajor(1800));
  });

  it("ignores missing products and handles an empty bundle", () => {
    expect(bundleTotals({ id: "b", name: "B", productIds: ["gone"], pricing: { kind: "percent", percent: 10 }, active: true }, ps, []).percentOff).toBe(0);
  });
});

describe("checkCoupon", () => {
  const items = [item("a", 500), item("b", 1500, "bump")];
  it("rejects missing, inactive, expired and used-up codes", () => {
    expect(checkCoupon(undefined, items, NOW).ok).toBe(false);
    expect(checkCoupon(coupon({ active: false }), items, NOW).ok).toBe(false);
    expect(checkCoupon(coupon({ expiresAt: iso(NOW - 1) }), items, NOW)).toEqual({ ok: false, error: "That code has expired." });
    expect(checkCoupon(coupon({ usageLimit: 5, used: 5 }), items, NOW)).toMatchObject({ ok: false });
  });

  it("applies percent to eligible items only", () => {
    expect(checkCoupon(coupon({ scope: "products", productIds: ["a"], value: 50 }), items, NOW)).toMatchObject({ ok: true, discount: fromMajor(250) });
    expect(checkCoupon(coupon({ scope: "products", productIds: ["zzz"] }), items, NOW)).toMatchObject({ ok: false });
  });

  it("caps fixed discounts at the eligible total", () => {
    expect(checkCoupon(coupon({ kind: "fixed", value: fromMajor(5000).amount }), items, NOW)).toMatchObject({ ok: true, discount: fromMajor(2000) });
  });

  it("supports 100% off for a zero total", () => {
    expect(checkCoupon(coupon({ value: 100 }), items, NOW)).toMatchObject({ ok: true, discount: fromMajor(2000) });
  });

  it("enforces minimum spend", () => {
    expect(checkCoupon(coupon({ minSpend: fromMajor(5000) }), items, NOW)).toMatchObject({ ok: false });
  });
});

describe("ratingSummary", () => {
  const r = (rating: Review["rating"], over: Partial<Review> = {}) => ({ rating, hidden: false, imported: false, ...over }) as Review;
  it("handles zero reviews", () => {
    expect(ratingSummary([])).toEqual({ average: 0, count: 0, bars: [0, 0, 0, 0, 0] });
  });
  it("skips hidden and imported reviews", () => {
    const s = ratingSummary([r(5), r(3), r(1, { hidden: true }), r(1, { imported: true })]);
    expect(s.count).toBe(2);
    expect(s.average).toBe(4);
    expect(s.bars).toEqual([0, 0, 1, 0, 1]);
  });
  it("copes with thousands", () => {
    const many = Array.from({ length: 5000 }, (_, i) => r(i % 2 ? 5 : 4));
    expect(ratingSummary(many)).toMatchObject({ count: 5000, average: 4.5 });
  });
});

describe("publicName", () => {
  it("shortens to first name and last initial", () => {
    expect(publicName("Asha Kumar")).toBe("Asha K.");
    expect(publicName("  Ravi  ")).toBe("Ravi");
    expect(publicName("")).toBe("Buyer");
    expect(publicName("Karthik Venkata subramaniam")).toBe("Karthik S.");
  });
});

describe("tax and checkout lines", () => {
  it("includes 18% GST for India and none for exports", () => {
    expect(includedGst(11800, "IN")).toBe(1800);
    expect(includedGst(11800, "US")).toBe(0);
  });

  it("builds lines in the buyer currency", () => {
    const lines = checkoutLines({ items: [item("a", 834)], buyerTotal: fromMajor(9, "USD"), total: fromMajor(750.6), countryCode: "US" });
    expect(lines.items[0].amount.currency).toBe("USD");
    expect(lines.total).toEqual(fromMajor(9, "USD"));
    expect(lines.tax.amount).toBe(0);
  });

  it("handles a zero total without dividing by zero", () => {
    const lines = checkoutLines({ items: [item("a", 100)], buyerTotal: money(0), total: money(0), countryCode: "IN" });
    expect(lines.discount.amount).toBe(10000);
    expect(lines.total.amount).toBe(0);
  });
});
