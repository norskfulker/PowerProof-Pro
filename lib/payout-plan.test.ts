import { describe, expect, it } from "vitest";
import { planPayout, type PlanInput } from "./payout-plan";

const rates = { INR: 84, USD: 1, EUR: 0.9, GBP: 0.75, AED: 3.67, SGD: 1.3, AUD: 1.5, CAD: 1.35 };
const base: PlanInput = { balanceCurrency: "INR", amountMinor: 250_000, sellerCountry: "IN", methodKind: "bank", hasFundAccount: true, rates };

describe("how a withdrawal is paid out", () => {
  it("pays an Indian bank account in rupees through Razorpay, by IMPS", () => {
    expect(planPayout(base)).toEqual({ route: "razorpayx", currency: "INR", amountMinor: 250_000, rate: 1, mode: "IMPS" });
  });
  it("uses UPI for a UPI id and NEFT above the IMPS limit", () => {
    expect(planPayout({ ...base, methodKind: "upi" })).toMatchObject({ route: "razorpayx", mode: "UPI" });
    expect(planPayout({ ...base, amountMinor: 60_000_000 })).toMatchObject({ route: "razorpayx", mode: "NEFT" });
  });
  it("converts a dollar balance into rupees for an Indian account", () => {
    const plan = planPayout({ ...base, balanceCurrency: "USD", amountMinor: 10_000, sellerCountry: "US" });
    expect(plan).toMatchObject({ route: "razorpayx", currency: "INR", amountMinor: 840_000 });
    expect(plan.route === "razorpayx" && plan.rate).toBeCloseTo(84);
  });
  it("keeps non-Indian routes in the by-hand queue, in the seller's own currency", () => {
    const plan = planPayout({ ...base, balanceCurrency: "USD", amountMinor: 10_000, sellerCountry: "GB", methodKind: null });
    expect(plan).toMatchObject({ route: "manual", currency: "GBP", amountMinor: 7_500 });
  });
  it("never invents an exchange rate", () => {
    const plan = planPayout({ ...base, balanceCurrency: "USD", amountMinor: 10_000, rates: { USD: 1 } });
    expect(plan).toMatchObject({ route: "manual", rate: null });
    expect(plan.route === "manual" && plan.reason).toMatch(/exchange rate/i);
  });
  it("sends crypto, old accounts and tiny amounts by hand", () => {
    expect(planPayout({ ...base, methodKind: "crypto" })).toMatchObject({ route: "manual", reason: expect.stringMatching(/crypto/i) });
    expect(planPayout({ ...base, hasFundAccount: false })).toMatchObject({ route: "manual", reason: expect.stringMatching(/add it again/i) });
    expect(planPayout({ ...base, amountMinor: 50 })).toMatchObject({ route: "manual" });
  });
});
