import { describe, expect, it } from "vitest";
import { fromMajor, money } from "../money";
import type { DealRule, DealRuleSpec } from "../types";
import { evaluateDeals, isRuleLive, ruleSummary, type CartLine, type DealProduct } from "./deals";

const NOW = Date.parse("2026-10-05T05:30:00Z");
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();

const P = (id: string, major: number, floor?: number): DealProduct => ({ id, title: id.toUpperCase(), price: fromMajor(major), floor: floor === undefined ? undefined : fromMajor(floor) });
const PRODUCTS = [P("a", 1000), P("b", 500), P("c", 300), P("d", 200), P("e", 1500, 1200), P("gift", 400), P("gift2", 250)];

let n = 0;
const rule = (spec: DealRuleSpec, over: Partial<DealRule> = {}): DealRule =>
  ({ id: `r${++n}`, name: `Rule ${n}`, active: true, stackable: false, createdAt: iso(NOW - DAY), stats: { views: 0, uses: 0, revenueLift: money(0) }, ...spec, ...over }) as DealRule;

const cart = (...ids: string[]): CartLine[] => ids.map((productId) => ({ productId }));
const run = (lines: CartLine[], rules: DealRule[], giftChoices?: Record<string, string>) => evaluateDeals({ lines, rules, products: PRODUCTS, giftChoices, now: NOW });

describe("no deals", () => {
  it("prices the cart as is", () => {
    const r = run(cart("a", "b"), []);
    expect(r.total).toEqual(fromMajor(1500));
    expect(r.saving.amount).toBe(0);
    expect(r.offers).toEqual([]);
  });
  it("handles an empty cart", () => {
    const r = run([], [rule({ kind: "spend_threshold", minSpend: fromMajor(100), percent: 10 })]);
    expect(r.total.amount).toBe(0);
    expect(r.lines).toEqual([]);
  });
  it("ignores unknown products", () => {
    expect(run(cart("zzz"), []).lines).toHaveLength(0);
  });
});

describe("rule types", () => {
  it("bundle discount needs every product", () => {
    const b = rule({ kind: "bundle_discount", productIds: ["a", "b"], percent: 20 });
    expect(run(cart("a"), [b]).saving.amount).toBe(0);
    const r = run(cart("a", "b"), [b]);
    expect(r.saving).toEqual(fromMajor(300));
    expect(r.appliedRuleIds).toEqual([b.id]);
    expect(r.lines.every((l) => l.ruleIds.includes(b.id))).toBe(true);
  });

  it("free gift adds the gift once, struck through as free", () => {
    const g = rule({ kind: "free_gift", triggerIds: ["a"], giftId: "gift" });
    const r = run(cart("a"), [g]);
    const gift = r.lines.find((l) => l.productId === "gift")!;
    expect(gift).toMatchObject({ free: true, gift: true, price: money(0), basePrice: fromMajor(400) });
    expect(r.total).toEqual(fromMajor(1000));
    expect(r.saving).toEqual(fromMajor(400));
  });

  it("free gift already in the cart becomes the free one instead of a duplicate", () => {
    const g = rule({ kind: "free_gift", triggerIds: ["a"], giftId: "gift" });
    const r = run(cart("a", "gift"), [g]);
    expect(r.lines.filter((l) => l.productId === "gift")).toHaveLength(1);
    expect(r.total).toEqual(fromMajor(1000));
  });

  it("gives a gift once per order even when two rules offer it", () => {
    const g1 = rule({ kind: "free_gift", triggerIds: ["a"], giftId: "gift" }, { stackable: true });
    const g2 = rule({ kind: "free_gift", triggerIds: [], minSpend: fromMajor(500), giftId: "gift" }, { stackable: true });
    const r = run(cart("a"), [g1, g2]);
    expect(r.lines.filter((l) => l.productId === "gift")).toHaveLength(1);
  });

  it("choose gift waits for the buyer's pick, then applies it", () => {
    const c = rule({ kind: "choose_gift", triggerIds: [], minSpend: fromMajor(800), giftIds: ["gift", "gift2"] });
    const before = run(cart("a"), [c]);
    expect(before.saving.amount).toBe(0);
    expect(before.pendingChoices).toEqual([c.id]);
    expect(before.offers[0]).toMatchObject({ kind: "choose_gift", giftOptions: ["gift", "gift2"], saving: fromMajor(400) });
    const after = run(cart("a"), [c], { [c.id]: "gift2" });
    expect(after.saving).toEqual(fromMajor(250));
    expect(after.pendingChoices).toEqual([]);
  });

  it("ignores a gift choice that isn't one of the options", () => {
    const c = rule({ kind: "choose_gift", triggerIds: [], giftIds: ["gift"] });
    expect(run(cart("a"), [c], { [c.id]: "a" }).saving.amount).toBe(0);
  });

  it("tiers pick the highest tier reached", () => {
    const t = rule({ kind: "tiers", productIds: [], tiers: [{ minItems: 2, percent: 10 }, { minItems: 3, percent: 20 }] });
    expect(run(cart("a"), [t]).saving.amount).toBe(0);
    expect(run(cart("a", "b"), [t]).saving).toEqual(fromMajor(150));
    expect(run(cart("a", "b", "c"), [t]).saving).toEqual(fromMajor(360));
  });

  it("spend threshold uses the price before deals", () => {
    const s = rule({ kind: "spend_threshold", minSpend: fromMajor(1500), percent: 10 });
    expect(run(cart("a", "c"), [s]).saving.amount).toBe(0);
    expect(run(cart("a", "b"), [s]).saving).toEqual(fromMajor(150));
  });

  it("buy X gets the cheapest free, one per full group", () => {
    const x = rule({ kind: "buy_x_get_cheapest", productIds: [], buy: 3 });
    expect(run(cart("a", "b"), [x]).saving.amount).toBe(0);
    const r = run(cart("a", "b", "d"), [x]);
    expect(r.saving).toEqual(fromMajor(200));
    expect(r.lines.find((l) => l.productId === "d")).toMatchObject({ free: true, gift: false });
  });

  it("limited time only runs inside its window", () => {
    const l = rule({ kind: "limited_time", productIds: ["b"], percent: 50 }, { endsAt: iso(NOW + DAY) });
    expect(run(cart("a", "b"), [l]).saving).toEqual(fromMajor(250));
    const ended = rule({ kind: "limited_time", productIds: ["b"], percent: 50 }, { endsAt: iso(NOW - 1) });
    expect(run(cart("a", "b"), [ended]).saving.amount).toBe(0);
    const later = rule({ kind: "limited_time", productIds: ["b"], percent: 50 }, { startsAt: iso(NOW + 1) });
    expect(isRuleLive(later, NOW)).toBe(false);
  });

  it("skips inactive rules", () => {
    expect(run(cart("a", "b"), [rule({ kind: "bundle_discount", productIds: ["a", "b"], percent: 20 }, { active: false })]).saving.amount).toBe(0);
  });
});

describe("best price and stacking", () => {
  it("picks the single best rule by default", () => {
    const small = rule({ kind: "bundle_discount", productIds: ["a", "b"], percent: 10 });
    const big = rule({ kind: "spend_threshold", minSpend: fromMajor(1000), percent: 20 });
    const r = run(cart("a", "b"), [small, big]);
    expect(r.appliedRuleIds).toEqual([big.id]);
    expect(r.saving).toEqual(fromMajor(300));
  });

  it("stacks rules marked stackable when that saves more", () => {
    const a = rule({ kind: "bundle_discount", productIds: ["a", "b"], percent: 10 }, { stackable: true });
    const g = rule({ kind: "free_gift", triggerIds: ["a"], giftId: "gift" }, { stackable: true });
    const r = run(cart("a", "b"), [a, g]);
    expect(r.appliedRuleIds.sort()).toEqual([a.id, g.id].sort());
    expect(r.saving).toEqual(fromMajor(550));
  });

  it("combines the best non-stackable rule with stackable ones", () => {
    const solo = rule({ kind: "spend_threshold", minSpend: fromMajor(1000), percent: 10 });
    const g = rule({ kind: "free_gift", triggerIds: [], giftId: "gift2" }, { stackable: true });
    const r = run(cart("a", "b"), [solo, g]);
    expect(r.appliedRuleIds.sort()).toEqual([solo.id, g.id].sort());
    expect(r.saving).toEqual(fromMajor(400));
  });

  it("never stacks two non-stackable rules", () => {
    const x = rule({ kind: "bundle_discount", productIds: ["a", "b"], percent: 10 });
    const y = rule({ kind: "free_gift", triggerIds: ["a"], giftId: "gift" });
    expect(run(cart("a", "b"), [x, y]).appliedRuleIds).toHaveLength(1);
  });

  it("respects price floors on percentage discounts", () => {
    const deep = rule({ kind: "bundle_discount", productIds: ["e", "a"], percent: 50 });
    const r = run(cart("e", "a"), [deep]);
    expect(r.lines.find((l) => l.productId === "e")!.price).toEqual(fromMajor(1200));
    expect(r.lines.find((l) => l.productId === "a")!.price).toEqual(fromMajor(500));
  });

  it("never discounts a locked line (the order bump)", () => {
    const s = rule({ kind: "spend_threshold", minSpend: fromMajor(100), percent: 50 });
    const r = run([{ productId: "a" }, { productId: "d", price: fromMajor(99), locked: true }], [s]);
    expect(r.lines.find((l) => l.productId === "d")!.price).toEqual(fromMajor(99));
    expect(r.total).toEqual(fromMajor(599));
  });

  it("never goes below zero and always adds up", () => {
    const all = [
      rule({ kind: "tiers", productIds: [], tiers: [{ minItems: 2, percent: 90 }] }, { stackable: true }),
      rule({ kind: "buy_x_get_cheapest", productIds: [], buy: 2 }, { stackable: true }),
      rule({ kind: "spend_threshold", minSpend: fromMajor(1), percent: 90 }, { stackable: true }),
    ];
    const r = run(cart("a", "b", "c", "d"), all);
    expect(r.total.amount).toBeGreaterThanOrEqual(0);
    expect(r.lines.every((l) => l.price.amount >= 0)).toBe(true);
    expect(r.subtotal.amount - r.saving.amount).toBe(r.total.amount);
  });

  it("is deterministic", () => {
    const rules = [rule({ kind: "tiers", productIds: [], tiers: [{ minItems: 2, percent: 10 }] }), rule({ kind: "free_gift", triggerIds: [], giftId: "gift" })];
    expect(run(cart("a", "b"), rules)).toEqual(run(cart("a", "b"), rules));
  });
});

describe("offers", () => {
  it("suggests the missing bundle product with the real extra saving", () => {
    const b = rule({ kind: "bundle_discount", productIds: ["a", "b"], percent: 20 });
    const r = run(cart("a"), [b]);
    expect(r.offers).toHaveLength(1);
    expect(r.offers[0]).toMatchObject({ ruleId: b.id, kind: "add", addProductIds: ["b"], saving: fromMajor(300), extraCost: fromMajor(200) });
  });

  it("suggests reaching the next tier with the cheapest products", () => {
    const t = rule({ kind: "tiers", productIds: [], tiers: [{ minItems: 2, percent: 10 }] });
    expect(run(cart("a"), [t]).offers[0].addProductIds).toEqual(["d"]);
  });

  it("shows progress towards a spend threshold", () => {
    const s = rule({ kind: "spend_threshold", minSpend: fromMajor(1400), percent: 10 });
    const o = run(cart("a"), [s]).offers[0];
    expect(o.progress).toEqual({ current: fromMajor(1000), target: fromMajor(1400) });
    expect(o.addProductIds).toEqual(["gift"]);
  });

  it("orders offers by saving and drops ones that save nothing", () => {
    const small = rule({ kind: "bundle_discount", productIds: ["a", "c"], percent: 10 });
    const big = rule({ kind: "bundle_discount", productIds: ["a", "b"], percent: 30 });
    const r = run(cart("a"), [small, big]);
    expect(r.offers.map((o) => o.ruleId)).toEqual([big.id, small.id]);
    expect(r.offers.every((o) => o.saving.amount > 0)).toBe(true);
  });

  it("counts the best gift when an addition would unlock a gift choice", () => {
    const c = rule({ kind: "choose_gift", triggerIds: [], minSpend: fromMajor(1200), giftIds: ["gift", "gift2"] });
    const o = run(cart("a"), [c]).offers.find((x) => x.kind === "add")!;
    expect(o.addProductIds).toEqual(["d"]);
    expect(o.saving).toEqual(fromMajor(400));
    expect(o.extraCost).toEqual(fromMajor(200));
  });

  it("does not count an already unlocked gift as a gain from adding more", () => {
    const c = rule({ kind: "choose_gift", triggerIds: [], giftIds: ["gift"] });
    const b = rule({ kind: "bundle_discount", productIds: ["a", "b"], percent: 10 }, { stackable: true });
    const r = run(cart("a"), [{ ...c, stackable: true }, b]);
    expect(r.offers.find((x) => x.kind === "add")!.saving).toEqual(fromMajor(150));
  });

  it("offers nothing once every rule is used up", () => {
    const b = rule({ kind: "bundle_discount", productIds: ["a", "b"], percent: 20 });
    expect(run(cart("a", "b"), [b]).offers).toEqual([]);
  });
});

describe("ruleSummary", () => {
  const t = (id: string) => id.toUpperCase();
  it.each<[DealRuleSpec, RegExp]>([
    [{ kind: "bundle_discount", productIds: ["a", "b"], percent: 20 }, /Buy A \+ B together, save 20%/],
    [{ kind: "tiers", productIds: [], tiers: [{ minItems: 3, percent: 20 }, { minItems: 2, percent: 10 }] }, /2 items 10% off, 3 items 20% off/],
    [{ kind: "spend_threshold", minSpend: fromMajor(2000), percent: 15 }, /Spend ₹2,000, get 15% off/],
    [{ kind: "buy_x_get_cheapest", productIds: [], buy: 3 }, /Buy 3, get the cheapest free/],
    [{ kind: "free_gift", triggerIds: ["a"], giftId: "gift" }, /Buy A: GIFT free/],
    [{ kind: "choose_gift", triggerIds: [], minSpend: fromMajor(999), giftIds: ["gift"] }, /pick a free gift/],
    [{ kind: "limited_time", productIds: ["a", "b", "c"], percent: 25 }, /A and 2 more: 25% off/],
  ])("describes %o", (spec, re) => {
    expect(ruleSummary(rule(spec), t)).toMatch(re);
  });
});
