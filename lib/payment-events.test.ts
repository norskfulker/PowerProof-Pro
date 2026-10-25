import { describe, expect, it } from "vitest";
import { currentPaymentState, fromRazorpay, unpaidCountdown, unpaidDeadline, UNPAID_TIMEOUT_MS } from "./payment-events";

const pay = (extra: Record<string, unknown> = {}) => ({ id: "pay_1", order_id: "order_1", amount: 49900, currency: "INR", method: "upi", created_at: 1_790_000_000, ...extra });

describe("fromRazorpay", () => {
  it("turns payment.captured and order.paid into the same success row, so it's stored once", () => {
    const a = fromRazorpay({ event: "payment.captured", created_at: 1_790_000_100, payload: { payment: { entity: pay() } } });
    const b = fromRazorpay({ event: "order.paid", created_at: 1_790_000_101, payload: { payment: { entity: pay() } } });
    expect(a?.kind).toBe("succeeded");
    expect(a?.providerEventId).toBe(b?.providerEventId);
    expect(a).toMatchObject({ source: "provider", paymentId: "pay_1", gatewayOrderId: "order_1", amountMinor: 49900, currency: "INR", method: "upi" });
  });

  it("keeps the provider's exact failure reason and code", () => {
    const e = fromRazorpay({ event: "payment.failed", payload: { payment: { entity: pay({ error_code: "BAD_REQUEST_ERROR", error_description: "Payment failed due to insufficient balance", error_reason: "insufficient_funds" }) } } });
    expect(e).toMatchObject({ kind: "failed", reason: "Payment failed due to insufficient balance", errorCode: "BAD_REQUEST_ERROR · insufficient_funds" });
  });

  it("never invents a reason the provider didn't give", () => {
    const e = fromRazorpay({ event: "payment.failed", payload: { payment: { entity: pay({ error_description: "NA", error_code: null }) } } });
    expect(e?.reason).toBeUndefined();
    expect(e?.errorCode).toBeUndefined();
  });

  it("follows a refund through its stages", () => {
    const refund = { id: "rfnd_1", payment_id: "pay_1", amount: 49900, currency: "INR" };
    expect(fromRazorpay({ event: "refund.created", payload: { refund: { entity: refund } } })?.kind).toBe("refund_processing");
    expect(fromRazorpay({ event: "refund.processed", payload: { refund: { entity: refund } } })).toMatchObject({ kind: "refunded", refundId: "rfnd_1", gatewayPaymentId: "pay_1" });
    expect(fromRazorpay({ event: "refund.failed", payload: { refund: { entity: refund } } })?.kind).toBe("refund_failed");
  });

  it("ignores events that aren't about an order's payment", () => {
    expect(fromRazorpay({ event: "subscription.charged", payload: {} })).toBeNull();
    expect(fromRazorpay({ event: "payout.processed", payload: {} })).toBeNull();
  });
});

describe("currentPaymentState", () => {
  const at = (m: number) => new Date(Date.UTC(2026, 9, 25, 10, m)).toISOString();
  it("is the latest step by time, whatever order they arrived in", () => {
    expect(currentPaymentState([{ kind: "succeeded", occurredAt: at(5) }, { kind: "initiated", occurredAt: at(0) }, { kind: "failed", occurredAt: at(2) }])).toBe("succeeded");
  });
  it("doesn't let a late failure undo a success", () => {
    expect(currentPaymentState([{ kind: "succeeded", occurredAt: at(2) }, { kind: "failed", occurredAt: at(3) }])).toBe("succeeded");
  });
  it("lets refunds follow a success", () => {
    expect(currentPaymentState([{ kind: "succeeded", occurredAt: at(1) }, { kind: "refund_processing", occurredAt: at(5) }, { kind: "refunded", occurredAt: at(9) }])).toBe("refunded");
  });
  it("is undefined with no events", () => {
    expect(currentPaymentState([])).toBeUndefined();
  });
});

describe("the unpaid-order timeout", () => {
  const created = "2026-10-25T10:00:00.000Z";
  it("applies to online orders still pending or failed", () => {
    expect(unpaidDeadline({ status: "pending", paymentMethod: "online", createdAt: created })).toBe(Date.parse(created) + UNPAID_TIMEOUT_MS);
    expect(unpaidDeadline({ status: "failed", paymentMethod: "online", createdAt: created })).toBeDefined();
  });
  it("never applies to paid, cash on delivery, cancelled or refunded orders", () => {
    for (const status of ["paid", "cancelled", "refunded", "cod"]) expect(unpaidDeadline({ status, paymentMethod: "online", createdAt: created })).toBeUndefined();
    expect(unpaidDeadline({ status: "pending", paymentMethod: "cod", createdAt: created })).toBeUndefined();
  });
  it("counts down in minutes, then says it's being cancelled", () => {
    const d = Date.parse(created) + UNPAID_TIMEOUT_MS;
    expect(unpaidCountdown(d, d - 23 * 60_000)).toBe("Cancels in 23 min");
    expect(unpaidCountdown(d, d - 30_000)).toBe("Cancels in 1 min");
    expect(unpaidCountdown(d, d + 1)).toBe("Cancelling now");
  });
});
