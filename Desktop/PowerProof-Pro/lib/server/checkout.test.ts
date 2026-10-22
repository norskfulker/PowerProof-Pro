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

describe("physical products: quantities, variants, stock, shipping and cash on delivery", () => {
  const shirt: ProductRow = { id: "shirt", title: "Tee", price_minor: 50000, hsn_sac: "6109", tax_rate_bps: 500, fulfilment: "physical", track_stock: true, variants: [{ id: "s", title: "S", price_minor: 50000, stock: 3 }, { id: "xl", title: "XL", price_minor: 60000, stock: 0 }] };
  const mug: ProductRow = { id: "mug", title: "Mug", price_minor: 30000, hsn_sac: "6912", tax_rate_bps: 1200, fulfilment: "physical", track_stock: true, stock: 10 };
  const ebook = p("ebook", 20000);
  const shipping = {
    zones: [
      { id: "in", name: "India", countries: ["IN"], rate: 5000, freeOver: 200000 },
      { id: "world", name: "Everywhere else", countries: ["*"], rate: 150000 },
    ],
    cod: { enabled: true, fee: 4000, maxOrder: 500000 },
  };
  const phys = { ...base, products: [shirt, mug, ebook], shipping };

  it("charges each unit, at the variant's price, plus the zone's flat rate", () => {
    const o = priceOrder({ ...phys, lines: [{ productId: "shirt", variantId: "s", quantity: 2 }, { productId: "mug", quantity: 1 }] });
    expect(o.items.find((i) => i.product_id === "shirt")).toMatchObject({ quantity: 2, variant_title: "S", line_total_minor: 100000, fulfilment: "physical" });
    expect(o.shipping).toBe(5000);
    expect(o.total).toBe(130000 + 5000);
    expect(o.physical).toBe(true);
  });

  it("ships free over the zone's amount, and charges the rest of the world its own rate", () => {
    expect(priceOrder({ ...phys, lines: [{ productId: "mug", quantity: 7 }] }).shipping).toBe(0);
    expect(priceOrder({ ...phys, countryCode: "US", lines: [{ productId: "mug", quantity: 1 }] }).shipping).toBe(150000);
    expect(() => priceOrder({ ...phys, shipping: { ...shipping, zones: [shipping.zones[0]] }, countryCode: "US", lines: [{ productId: "mug" }] })).toThrow(/doesn't ship/);
  });

  it("stops at what's in stock, and needs an option when there are variants", () => {
    expect(() => priceOrder({ ...phys, lines: [{ productId: "shirt", variantId: "s", quantity: 4 }] })).toThrow(/Only 3 of Tee \(S\) left/);
    expect(() => priceOrder({ ...phys, lines: [{ productId: "shirt", variantId: "xl" }] })).toThrow(/sold out/);
    expect(() => priceOrder({ ...phys, lines: [{ productId: "shirt" }] })).toThrow(/Pick an option/);
    expect(() => priceOrder({ ...phys, lines: [{ productId: "mug", variantId: "s" }] })).toThrow(/options isn't for sale/);
  });

  it("downloads are always one, however many are asked for", () => {
    expect(priceOrder({ ...phys, lines: [{ productId: "ebook", quantity: 5 }] }).items[0].quantity).toBe(1);
  });

  it("takes cash on delivery only for shipped-only orders in India, within the limit, with its fee", () => {
    const o = priceOrder({ ...phys, cod: true, lines: [{ productId: "mug" }] });
    expect(o.codFee).toBe(4000);
    expect(o.total).toBe(30000 + 5000 + 4000);
    expect(() => priceOrder({ ...phys, cod: true, lines: [{ productId: "mug" }, { productId: "ebook" }] })).toThrow(/everything is shipped/);
    expect(() => priceOrder({ ...phys, cod: true, countryCode: "US", lines: [{ productId: "mug" }] })).toThrow(/only available in India/);
    expect(() => priceOrder({ ...phys, shipping: { ...shipping, cod: { enabled: true, fee: 4000, maxOrder: 100000 } }, cod: true, lines: [{ productId: "mug", quantity: 4 }] })).toThrow(/too large/);
    expect(() => priceOrder({ ...phys, shipping: { ...shipping, cod: { enabled: false, fee: 0 } }, cod: true, lines: [{ productId: "mug" }] })).toThrow(/doesn't take cash/);
  });

  it("puts GST in the shipping at the main item's rate, for a registered seller in India", () => {
    const o = priceOrder({ ...phys, lines: [{ productId: "shirt", variantId: "s" }, { productId: "mug" }] });
    const goodsTax = (50000 - Math.round(50000 / 1.05)) + (30000 - Math.round(30000 / 1.12));
    expect(o.tax).toBe(goodsTax + (5000 - Math.round(5000 / 1.12)));
    expect(priceOrder({ ...phys, registered: false, lines: [{ productId: "mug" }] }).tax).toBe(0);
  });

  it("a percentage deal takes off every unit; a free one, only one unit", () => {
    const pct = rule({ id: "pct", kind: "bundle_discount", productIds: ["mug", "ebook"], percent: 50 });
    const both = priceOrder({ ...phys, rules: [pct], lines: [{ productId: "mug", quantity: 2 }, { productId: "ebook" }] });
    expect(both.items.find((i) => i.product_id === "mug")?.line_total_minor).toBe(30000);
    // The gift is already in the cart three times: one of them is free, not all three
    const gift = rule({ id: "gift", kind: "free_gift", triggerIds: ["ebook"], giftId: "mug" } as never);
    const g = priceOrder({ ...phys, rules: [gift], lines: [{ productId: "ebook" }, { productId: "mug", quantity: 3 }] });
    expect(g.dealIds).toContain("gift");
    expect(g.items.find((i) => i.product_id === "mug")?.line_total_minor).toBe(60000);
  });

  it("needs the store's shipping set up before anything ships", () => {
    expect(() => priceOrder({ ...base, products: [mug], lines: [{ productId: "mug" }] })).toThrow(/hasn't set up shipping/);
  });
});
