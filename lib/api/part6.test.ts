import { describe, expect, it } from "vitest";
import { planComparison, proBenefits } from "../plans";
import { limitsFromRows } from "../plan-limits";
import { summarize, type DailyRow, type ProductSalesRow } from "./analytics";
import { TAX_CODES } from "../tax-codes";
import { TEST_PLAN_LIMITS } from "@/tests/fixtures";

describe("plan limits come from the database rows", () => {
  const rows = [
    { plan: "free" as const, max_stores: 1, max_products: 10, max_pages: 3, ai_credits_monthly: 10, custom_domain: false, platform_fee_bps: 300 },
    { plan: "pro" as const, max_stores: null, max_products: null, max_pages: null, ai_credits_monthly: 200, custom_domain: true, platform_fee_bps: 300 },
  ];
  it("maps the rows one to one", () => {
    expect(limitsFromRows(rows)).toEqual(TEST_PLAN_LIMITS);
  });
  it("throws instead of inventing limits when a plan is missing", () => {
    expect(() => limitsFromRows([rows[0]])).toThrow();
    expect(() => limitsFromRows([])).toThrow();
    expect(() => limitsFromRows(null)).toThrow();
  });
  it("keeps the same per-sale fee on both plans", () => {
    const fee = planComparison(TEST_PLAN_LIMITS).find((r) => r.feature === "Fee per sale")!;
    expect(fee.free).toBe(fee.pro);
  });
  it("lists what Pro adds, from those limits", () => {
    expect(proBenefits(TEST_PLAN_LIMITS).join(" ")).toMatch(/200 AI image credits/);
  });
});

describe("dashboard numbers", () => {
  const NOW = Date.parse("2026-10-07T06:00:00Z"); // 11:30 on 7 Oct in India
  const row = (day: string, orders_count: number, gross_minor: number): DailyRow => ({ day, orders_count, gross_minor });
  const product = (product_id: string, title: string, units: number, revenue_minor: number): ProductSalesRow => ({ product_id, title, units, revenue_minor });

  it("has nothing for a store with no sales", () => {
    const s = summarize([], [], "30d", NOW);
    expect(s.sales).toBe(0);
    expect(s.revenue.amount).toBe(0);
    expect(s.topProducts).toEqual([]);
    expect(s.series.length).toBeGreaterThan(0);
  });

  it("adds up the days in the range and leaves older ones out", () => {
    const s = summarize([row("2026-10-06", 1, 50000), row("2026-10-05", 1, 25000), row("2026-07-01", 4, 99900)], [], "30d", NOW);
    expect(s.sales).toBe(2);
    expect(s.revenue.amount).toBe(75000);
  });

  it("counts the India day, so the 7 Oct sale is today", () => {
    const s = summarize([row("2026-10-07", 2, 1000)], [], "today", NOW);
    expect(s.sales).toBe(2);
    expect(s.series).toHaveLength(1);
  });

  it("ranks products by revenue", () => {
    const s = summarize([], [product("a", "A", 1, 100), product("b", "B", 9, 900)], "30d", NOW);
    expect(s.topProducts.map((p) => p.productId)).toEqual(["b", "a"]);
  });

  it("never estimates visitors, conversion, sources or a funnel", () => {
    const s = summarize([row("2026-10-06", 1, 50000)], [], "30d", NOW);
    expect(s.visitors).toBeNull();
    expect(s.conversion).toBeNull();
    expect(s.deltas.visitors).toBeNull();
    expect(s.deltas.conversion).toBeNull();
    expect(s.sources).toEqual([]);
    expect(s.funnel).toEqual([]);
    expect(s.series.every((p) => !("visitors" in p))).toBe(true);
  });

  it("uses the store's own visit counts once they exist: visitors, conversion, sources and the funnel", () => {
    const now = { visitors: 40, viewers: 20, started: 6, paid: 4, days: [{ day: "2026-10-06", visitors: 25 }, { day: "2026-10-05", visitors: 15 }], sources: [{ source: "google", visitors: 30 }, { source: "weird.example", visitors: 10 }] };
    const before = { visitors: 20, viewers: 8, started: 2, paid: 1, days: [], sources: [] };
    const s = summarize([row("2026-10-06", 4, 200000)], [], "30d", NOW, "INR", { now, before });
    expect(s.visitors).toBe(40);
    expect(s.conversion).toBe(10);
    expect(s.deltas.visitors).toBe(100);
    expect(s.deltas.conversion).toBe(100);
    expect(s.sources).toEqual([{ source: "google", visitors: 30, share: 75 }, { source: "other", visitors: 10, share: 25 }]);
    expect(s.funnel).toEqual([{ label: "Visitors", value: 40 }, { label: "Viewed a product", value: 20 }, { label: "Started checkout", value: 6 }, { label: "Paid", value: 4 }]);
    expect(s.series.reduce((t, p) => t + (p.visitors ?? 0), 0)).toBe(40);
  });

  it("with visit tracking on but no visits yet, shows zeros rather than guesses", () => {
    const zero = { visitors: 0, viewers: 0, started: 0, paid: 0, days: [], sources: [] };
    const s = summarize([], [], "7d", NOW, "INR", { now: zero, before: zero });
    expect(s.visitors).toBe(0);
    expect(s.conversion).toBe(0);
    expect(s.deltas.visitors).toBeNull();
  });

  it("has no change figure without a previous period to compare with", () => {
    expect(summarize([row("2026-10-06", 1, 50000)], [], "30d", NOW).deltas.revenue).toBeNull();
    expect(summarize([row("2026-10-06", 1, 50000), row("2026-09-01", 1, 25000)], [], "30d", NOW).deltas.revenue).toBe(100);
  });
});

describe("tax codes", () => {
  it("has exactly one default and valid 4 to 8 digit codes", () => {
    expect(TAX_CODES.filter((c) => c.isDefault)).toHaveLength(1);
    for (const c of TAX_CODES) expect(c.code).toMatch(/^\d{4,8}$/);
  });
});
