import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keyMode, razorpayConfig, verifyKeys, verifyPaymentSignature, verifyWebhookSignature } from "./razorpay";

const sign = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex");

describe("razorpay", () => {
  it("needs both keys, and says nothing is connected without them", () => {
    expect(razorpayConfig({})).toBeNull();
    expect(razorpayConfig({ RAZORPAY_KEY_ID: "k" })).toBeNull();
    expect(razorpayConfig({ RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w" })).toEqual({ keyId: "k", keySecret: "s", webhookSecret: "w" });
  });

  it("accepts a payment signature made with the secret, and nothing else", () => {
    const good = sign("secret", "order_1|pay_1");
    expect(verifyPaymentSignature("order_1", "pay_1", good, "secret")).toBe(true);
    expect(verifyPaymentSignature("order_1", "pay_2", good, "secret")).toBe(false);
    expect(verifyPaymentSignature("order_1", "pay_1", good, "other")).toBe(false);
    expect(verifyPaymentSignature("order_1", "pay_1", "", "secret")).toBe(false);
    expect(verifyPaymentSignature("order_1", "pay_1", "short", "secret")).toBe(false);
  });

  it("checks webhooks over the exact body", () => {
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(body, sign("w", body), "w")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sign("w", body), "w")).toBe(false);
    expect(verifyWebhookSignature(body, "", "w")).toBe(false);
  });
});

describe("checking the keys", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("reads test or live from the key itself", () => {
    expect(keyMode("rzp_test_abc")).toBe("test");
    expect(keyMode("rzp_live_abc")).toBe("live");
    expect(keyMode("something")).toBeNull();
  });
  it("tells accepted keys from rejected ones and from a provider that can't be reached", async () => {
    const cfg = { keyId: "rzp_test_a", keySecret: "s" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValueOnce({ ok: false, status: 502 }).mockRejectedValueOnce(new Error("offline")));
    expect(await verifyKeys(cfg)).toEqual({ ok: true });
    expect(await verifyKeys(cfg)).toEqual({ ok: false, reason: "rejected" });
    expect(await verifyKeys(cfg)).toEqual({ ok: false, reason: "unreachable" });
    expect(await verifyKeys(cfg)).toEqual({ ok: false, reason: "unreachable" });
  });
});
