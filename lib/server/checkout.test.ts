import { describe, expect, it } from "vitest";
import { CheckoutError, couponDiscount, includedTax, priceOrder, type CouponRow, type ProductRow } from "./checkout";
import type { DealRule } from "../types";

const p = (id: string, price: number, rate: number | null = 1800): ProductRow => ({ id, title: `Product ${id}`, price_minor: price, hsn_sac: "998433", tax_rate_bps: rate });
const products = [p("a", 50000), p("b", 30000), p("c", 20000)];
const base = { currency: "INR" as const, products, rules: [] as DealRule[], countryCode: "IN", registered: true, now: Date.parse("2026-10-10T00:00:00Z") };
const coupon = (o: Partial<CouponRow> = {}): CouponRow => ({ id: "cp", kind: "percent", value: 2000, min_subtotal_minor: null, product_id: null, max_uses: null, used_count: 0, starts_at: null, ends_at: null, active: true, ...o });
const rule = (o: Partial<DealRule>) => ({ id: "r1", name: "Bundle", active: true, stackable: false, createdAt: "2026-01-01T00:00:00Z", kind: "bundle_discount", productIds: ["a", "b"], percent: 25, ...o }) as DealRule;

describe("pricing an order on the server", () => {
  it("prices from the database, not the request: one product at its price", () => {
    const o = priceOrder({ ...base, productIds: ["a"] });
    expect(o).toMatchObject({ subtotal: 50000, discount: 0, total: 50000, couponId: null });
    expect(o.tax).toBe(50000 - Math.round(50000 / 1.18));
  });

  it("asking twice for a product doesn't charge twice, and an unknown product is refused", () => {
    expect(priceOrder({ ...base, productIds: ["a", "a"] }).total).toBe(50000);
    expect(() => priceOrder({ ...base, productIds: ["zzz"] })).toThrow(/isn't for sale/);
    expect(() => priceOrder({ ...base, productIds: [] })).toThrow(/empty/);
  });

  it("applies a bundle deal only when the whole bundle is in the cart", () => {
    const rules = [rule({})];
    expect(priceOrder({ ...base, rules, productIds: ["a"] }).total).toBe(50000);
    const both = priceOrder({ ...base, rules, productIds: ["a", "b"] });
    expect(both.total).toBe(60000);
    expect(both.discount).toBe(20000);
    expect(both.dealIds).toEqual(["r1"]);
  });

  it("takes a percent coupon off after deals, a fixed one at most the order, and refuses a bad code", () => {
    expect(priceOrder({ ...base, productIds: ["a"], coupon: coupon() }).total).toBe(40000);
    expect(priceOrder({ ...base, productIds: ["c"], coupon: coupon({ kind: "fixed", value: 999999 }) }).total).toBe(0);
    expect(() => priceOrder({ ...base, productIds: ["a"], coupon: coupon({ active: false }) })).toThrow(CheckoutError);
    expect(() => priceOrder({ ...base, productIds: ["a"], coupon: coupon({ ends_at: "2026-01-01T00:00:00Z" }) })).toThrow(/expired/);
    expect(() => priceOrder({ ...base, productIds: ["a"], coupon: coupon({ max_uses: 3, used_count: 3 }) })).toThrow(/used up/);
    expect(() => priceOrder({ ...base, productIds: ["a"], coupon: coupon({ product_id: "b" }) })).toThrow(/doesn't apply/);
    expect(() => priceOrder({ ...base, productIds: ["c"], coupon: coupon({ min_subtotal_minor: 30000 }) })).toThrow(/Spend a little more/);
  });

  it("a product-only coupon discounts just that product", () => {
    const o = priceOrder({ ...base, productIds: ["a", "b"], coupon: coupon({ product_id: "b" }) });
    expect(o.total).toBe(50000 + 24000);
  });

  it("the order bump is added at its special price and not discounted again", () => {
    const o = priceOrder({ ...base, productIds: ["a"], bump: { productId: "c", price: 9900 }, coupon: undefined });
    expect(o.total).toBe(50000 + 9900);
    expect(o.items.find((i) => i.product_id === "c")?.line_total_minor).toBe(9900);
  });

  it("charges GST only to a registered seller selling to India", () => {
    const items = [{ line_total_minor: 11800, tax_rate_bps: 1800 }];
    expect(includedTax(items, "IN", true)).toBe(1800);
    expect(includedTax(items, "IN", false)).toBe(0);
    expect(includedTax(items, "US", true)).toBe(0);
    expect(includedTax([{ line_total_minor: 11800, tax_rate_bps: 0 }], "IN", true)).toBe(0);
  });

  it("marks every discount-code problem as the code's, so a live quote can carry on without it", () => {
    const scopes = [coupon({ active: false }), coupon({ ends_at: "2026-01-01T00:00:00Z" }), coupon({ starts_at: "2027-01-01T00:00:00Z" }), coupon({ max_uses: 1, used_count: 1 }), coupon({ product_id: "b" }), coupon({ min_subtotal_minor: 999999 })].map((c) => {
      try {
        priceOrder({ ...base, productIds: ["a"], coupon: c });
        return "none";
      } catch (e) {
        return e instanceof CheckoutError ? e.scope : "other";
      }
    });
    expect(scopes).toEqual(Array(6).fill("coupon"));
    // ...but a missing product is not the code's fault
    expect(() => priceOrder({ ...base, productIds: ["zzz"] })).toThrow(expect.objectContaining({ scope: undefined }));
  });

  it("a coupon's own checks work on their own too", () => {
    expect(couponDiscount(coupon(), [{ productId: "a", amount: 1000 }]).discount).toBe(200);
    expect(() => couponDiscount(undefined, [])).toThrow(/doesn't exist/);
  });
});
