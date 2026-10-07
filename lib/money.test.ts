import { describe, expect, it } from "vitest";
import { add, feeBreakdown, formatBytes, formatMoney, fromMajor, localPrice, money, sub, sum, toMajor } from "./money";

describe("money basics", () => {
  it("rounds to whole minor units", () => {
    expect(money(149.6)).toEqual({ amount: 150, currency: "INR" });
    expect(fromMajor(499.99)).toEqual({ amount: 49999, currency: "INR" });
    expect(toMajor(fromMajor(12.5, "USD"))).toBe(12.5);
  });

  it("adds, subtracts and sums in one currency", () => {
    expect(add(fromMajor(100), fromMajor(0.5)).amount).toBe(10050);
    expect(sub(fromMajor(100), fromMajor(150)).amount).toBe(-5000);
    expect(sum([fromMajor(1), fromMajor(2), fromMajor(3)]).amount).toBe(600);
    expect(sum([], "USD")).toEqual({ amount: 0, currency: "USD" });
  });
});

describe("formatMoney", () => {
  it("uses Indian digit grouping for INR", () => {
    expect(formatMoney(fromMajor(1234567.5))).toBe("₹12,34,567.50");
  });

  it("formats zero, tiny and huge amounts", () => {
    expect(formatMoney(money(0))).toBe("₹0.00");
    expect(formatMoney(money(1))).toBe("₹0.01");
    expect(formatMoney(fromMajor(9_999_999))).toBe("₹99,99,999.00");
  });

  it("puts a space after letter symbols", () => {
    expect(formatMoney(fromMajor(49, "AED"))).toBe("AED 49.00");
    expect(formatMoney(fromMajor(49, "SGD"))).toBe("S$49.00");
  });

  it("uses a real minus sign and an optional plus", () => {
    expect(formatMoney(fromMajor(-25))).toBe("−₹25.00");
    expect(formatMoney(fromMajor(25), { signed: true })).toBe("+₹25.00");
    expect(formatMoney(money(0), { signed: true })).toBe("₹0.00");
  });

  it("compacts lakhs for INR and thousands for others", () => {
    expect(formatMoney(fromMajor(250000), { compact: true })).toBe("₹2.50L");
    expect(formatMoney(fromMajor(99999), { compact: true })).toBe("₹99,999.00");
    expect(formatMoney(fromMajor(12500, "USD"), { compact: true })).toBe("$12.50k");
  });

  it("uses each currency's locale grouping", () => {
    expect(formatMoney(fromMajor(1234.5, "EUR"))).toBe("€1.234,50");
    expect(formatMoney(fromMajor(1234.5, "GBP"))).toBe("£1,234.50");
  });
});

describe("buyer prices", () => {
  it("are shown as they are: no exchange rate is connected, so nothing is converted or estimated", () => {
    const m = fromMajor(1499);
    expect(localPrice(m, "USD")).toBe(m);
    expect(localPrice(m)).toBe(m);
    expect(localPrice(m, "INR")).toBe(m);
  });
});

describe("feeBreakdown", () => {
  it("splits a sale into gateway, platform and what the creator keeps", () => {
    const f = feeBreakdown(fromMajor(1000), 5, 2);
    expect(f.gateway.amount).toBe(2000);
    expect(f.platform.amount).toBe(5000);
    expect(f.keep.amount).toBe(93000);
    expect(f.keepPct).toBeCloseTo(93);
  });

  it("handles a zero sale", () => {
    expect(feeBreakdown(money(0)).keepPct).toBe(0);
  });
});

describe("formatBytes", () => {
  it("picks a sensible unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
