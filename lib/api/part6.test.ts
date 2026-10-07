import { describe, expect, it } from "vitest";
import { planComparison, proBenefits } from "../plans";
import { limitsFromRows } from "../plan-limits";
import { summarize, type DailyRow, type ProductSalesRow } from "./analytics";
import { TAX_CODES } from "../tax-codes";
import { TEST_PLAN_LIMITS } from "@/tests/fixtures";

describe("plan limits come from the database rows", () => {
  const rows = [
    { plan: "free" as const, max_stores: 1, max_products: 1, ai_credits_monthly: 10, custom_domain: false, platform_fee_bps: 300 },
    { plan: "pro" as const, max_stores: null, max_products: null, ai_credits_monthly: 200, custom_domain: true, platform_fee_bps: 300 },
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
