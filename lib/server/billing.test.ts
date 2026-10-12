import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PRO_TRIAL_DAYS, trialEndsAt } from "../plans";
import { verifySubscriptionSignature } from "./razorpay";

describe("pro billing", () => {
  it("trial ends 30 days out", () => {
    const from = new Date("2026-10-12T00:00:00Z");
    expect(trialEndsAt(from).toISOString()).toBe("2026-11-11T00:00:00.000Z");
    expect(PRO_TRIAL_DAYS).toBe(30);
  });

  it("verifies the subscription auth signature (payment|subscription)", () => {
    const secret = "test_secret";
    const payment = "pay_123";
    const sub = "sub_456";
    const sig = createHmac("sha256", secret).update(`${payment}|${sub}`).digest("hex");
    expect(verifySubscriptionSignature(payment, sub, sig, secret)).toBe(true);
    expect(verifySubscriptionSignature(payment, sub, `${sig}x`.slice(1), secret)).toBe(false);
    expect(verifySubscriptionSignature("", sub, sig, secret)).toBe(false);
  });
});
