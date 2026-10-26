import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PRO_PRICE_LABEL, PRO_TRIAL_DAYS, trialEndsAt, trialRunning } from "../plans";
import { verifySubscriptionSignature } from "./razorpay";

describe("pro billing", () => {
  it("trial ends 30 days out", () => {
    const from = new Date("2026-10-12T00:00:00Z");
    expect(trialEndsAt(from).toISOString()).toBe("2026-11-11T00:00:00.000Z");
    expect(PRO_TRIAL_DAYS).toBe(30);
  });

  it("counts the free month only while the card is set up and the first charge is ahead", () => {
    const now = Date.parse("2026-10-26T00:00:00Z");
    const later = "2026-11-20T00:00:00Z";
    expect(trialRunning("authenticated", later, now)).toBe(true);
    expect(trialRunning("active", later, now)).toBe(true);
    expect(trialRunning("active", "2026-10-01T00:00:00Z", now)).toBe(false);
    expect(trialRunning("cancelled", later, now)).toBe(false);
    expect(trialRunning("created", later, now)).toBe(false);
    expect(trialRunning("authenticated", null, now)).toBe(false);
  });

  it("prints the Pro price the Indian way", () => {
    expect(PRO_PRICE_LABEL).toBe("₹1,999");
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
