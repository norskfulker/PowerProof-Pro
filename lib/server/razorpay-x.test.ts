import { afterEach, describe, expect, it, vi } from "vitest";
import { createFundAccount, createPayout, payoutConfig } from "./razorpay";

const keys = { RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: "secret" };

afterEach(() => vi.unstubAllGlobals());

describe("RazorpayX", () => {
  it("needs the account number as well as the keys", () => {
    expect(payoutConfig(keys)).toBeNull();
    expect(payoutConfig({ ...keys, RAZORPAYX_ACCOUNT_NUMBER: "2323230012345678" })).toMatchObject({ accountNumber: "2323230012345678" });
    expect(payoutConfig({ RAZORPAYX_ACCOUNT_NUMBER: "1" })).toBeNull();
  });

  it("registers a contact and then a bank account, sending the number only to Razorpay", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ id: calls.length === 1 ? "cont_1" : "fa_1" }), { status: 200 });
    }));
    const fa = await createFundAccount({ keyId: "k", keySecret: "s" }, { name: "Asha Rao", email: "a@x.com", reference: "u1", ifsc: "HDFC0001234", accountNumber: "123456789012" });
    expect(fa.id).toBe("fa_1");
    expect(calls[0].url).toMatch(/\/contacts$/);
    expect(calls[1].url).toMatch(/\/fund_accounts$/);
    expect(calls[1].body).toMatchObject({ contact_id: "cont_1", account_type: "bank_account", bank_account: { ifsc: "HDFC0001234", account_number: "123456789012" } });
  });

  it("pays in rupees from the RazorpayX account with the payout's own id as the idempotency key", async () => {
    let seen: { headers: Record<string, string>; body: Record<string, unknown> } | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      seen = { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ id: "pout_1", status: "processing" }), { status: 200 });
    }));
    const cfg = payoutConfig({ ...keys, RAZORPAYX_ACCOUNT_NUMBER: "2323230012345678" })!;
    const out = await createPayout(cfg, { fundAccountId: "fa_1", amount: 250_000, mode: "IMPS", reference: "11111111-2222-3333-4444-555555555555" });
    expect(out.id).toBe("pout_1");
    expect(seen!.headers["X-Payout-Idempotency"]).toBe("11111111-2222-3333-4444-555555555555");
    expect(seen!.body).toMatchObject({ account_number: "2323230012345678", fund_account_id: "fa_1", amount: 250_000, currency: "INR", mode: "IMPS" });
  });

  it("passes on Razorpay's own refusal in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { description: "Insufficient balance" } }), { status: 400 })));
    const cfg = payoutConfig({ ...keys, RAZORPAYX_ACCOUNT_NUMBER: "1" })!;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createPayout(cfg, { fundAccountId: "fa", amount: 100, mode: "UPI", reference: "r" })).rejects.toThrow("Insufficient balance");
  });
});
