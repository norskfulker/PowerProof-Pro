import { describe, expect, it } from "vitest";
import { paymentSummary, periodOf, salesSummary, visitorSummary } from "./dashboard-metrics";

// 25 Oct 2026, 15:30 in India (10:00 UTC)
const now = Date.UTC(2026, 9, 25, 10, 0);
const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();

describe("periodOf", () => {
  it("is the last 24 hours, hour by hour, for 1D", () => {
    const p = periodOf("1d", now);
    expect(p.end - p.start).toBe(24 * 3_600_000);
    expect(p.start - p.prevStart).toBe(24 * 3_600_000);
  });
  it("ends at the end of today in India for 7D and 30D", () => {
    const p = periodOf("7d", now);
    // 26 Oct 00:00 IST = 25 Oct 18:30 UTC
    expect(new Date(p.end).toISOString()).toBe("2026-10-25T18:30:00.000Z");
    expect((p.end - p.start) / 86_400_000).toBe(7);
  });
});

describe("salesSummary", () => {
  it("adds up revenue and orders in the period, compares with the one before, and fills each bucket", () => {
    const rows = [
      { at: ago(1), amountMinor: 50000 },
      { at: ago(2), amountMinor: 25000 },
      { at: ago(30), amountMinor: 50000 }, // the day before: previous period
      { at: ago(80), amountMinor: 99999 }, // outside both
    ];
    const s = salesSummary(rows, "1d", now);
    expect(s.primary).toBe(75000);
    expect(s.secondary).toBe(2);
    expect(s.previous).toBe(50000);
    expect(s.change).toBe(50);
    expect(s.buckets).toHaveLength(24);
    expect(s.buckets.reduce((t, b) => t + b.value, 0)).toBe(75000);
    expect(s.buckets.reduce((t, b) => t + (b.extra ?? 0), 0)).toBe(2);
  });
  it("has no change to show when there was nothing before", () => {
    expect(salesSummary([{ at: ago(1), amountMinor: 100 }], "7d", now).change).toBeNull();
  });
  it("is all zeros with no data, never made up", () => {
    const s = salesSummary([], "30d", now);
    expect(s.primary).toBe(0);
    expect(s.buckets).toHaveLength(30);
    expect(s.buckets.every((b) => b.value === 0)).toBe(true);
  });
});

describe("visitorSummary", () => {
  it("counts each browser session once, and page views separately", () => {
    const rows = [
      { at: ago(1), session: "aaaaaaaa1" },
      { at: ago(1), session: "aaaaaaaa1" },
      { at: ago(3), session: "bbbbbbbb2" },
      { at: ago(26), session: "cccccccc3" },
    ];
    const s = visitorSummary(rows, "1d", now);
    expect(s.primary).toBe(2);
    expect(s.secondary).toBe(3);
    expect(s.previous).toBe(1);
  });
});

describe("paymentSummary", () => {
  it("collects successful payments and works out the success rate of finished attempts", () => {
    const s = paymentSummary(
      [
        { at: ago(1), kind: "succeeded", amountMinor: 1000 },
        { at: ago(2), kind: "failed", amountMinor: 1000 },
        { at: ago(2), kind: "abandoned", amountMinor: 1000 },
        { at: ago(3), kind: "succeeded", amountMinor: 3000 },
      ],
      "7d",
      now
    );
    expect(s.primary).toBe(4000);
    expect(s.succeeded).toBe(2);
    expect(s.failed).toBe(2);
    expect(s.secondary).toBe(50);
  });
});
