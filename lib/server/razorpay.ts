import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay, spoken to directly over HTTPS (no SDK to keep up to date). Keys come from the
 * environment and never reach the browser. Without them every function says so instead of pretending.
 */
export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export function razorpayConfig(env: Record<string, string | undefined> = process.env): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  return keyId && keySecret ? { keyId, keySecret, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || undefined } : null;
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const hmac = (secret: string, payload: string | Buffer) => createHmac("sha256", secret).update(payload).digest("hex");

/** After paying, the browser hands back a signature over "order|payment": only Razorpay's secret can make it. */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  return !!orderId && !!paymentId && !!signature && safeEqual(hmac(secret, `${orderId}|${paymentId}`), signature);
}

/** Webhooks are signed over the raw request body */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean {
  return !!signature && safeEqual(hmac(secret, rawBody), signature);
}

export class GatewayError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

async function call<T>(cfg: RazorpayConfig, path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}`, ...extraHeaders },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T;
  if (!res.ok) {
    console.error(`[razorpay] ${path} answered ${res.status}: ${json.error?.description ?? "no detail"}`);
    throw new GatewayError(json.error?.description ?? "The payment provider didn't accept that.", res.status >= 500 ? 502 : 400);
  }
  return json;
}

/** An order to pay: amount in minor units (paise, cents) */
export function createGatewayOrder(cfg: RazorpayConfig, o: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }) {
  return call<{ id: string; amount: number; currency: string }>(cfg, "/orders", { amount: o.amount, currency: o.currency, receipt: o.receipt.slice(0, 40), notes: o.notes });
}

/** Gives the money back to the buyer's original payment method */
export function refundPayment(cfg: RazorpayConfig, paymentId: string, o: { amount: number; reason?: string; receipt: string }) {
  return call<{ id: string; status: string }>(cfg, `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: o.amount, speed: "normal", receipt: o.receipt.slice(0, 40), notes: { reason: (o.reason ?? "").slice(0, 200) } });
}

/** "test" or "live" from the key's own prefix (rzp_test_… / rzp_live_…), or null when it isn't a Razorpay key */
export const keyMode = (keyId: string): "test" | "live" | null => (keyId.startsWith("rzp_test_") ? "test" : keyId.startsWith("rzp_live_") ? "live" : null);

/** Asks Razorpay whether these keys are accepted (a read-only call). */
export async function verifyKeys(cfg: RazorpayConfig): Promise<{ ok: true } | { ok: false; reason: "rejected" | "unreachable" }> {
  try {
    const res = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (res.ok) return { ok: true };
    return { ok: false, reason: res.status === 401 || res.status === 403 ? "rejected" : "unreachable" };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

/* RazorpayX: payouts to sellers ------------------------------------------------------------------ */

/** RazorpayX uses the same API keys; payouts also need the number of the RazorpayX account the money is sent from */
export interface PayoutConfig extends RazorpayConfig {
  accountNumber: string;
}
export function payoutConfig(env: Record<string, string | undefined> = process.env): PayoutConfig | null {
  const base = razorpayConfig(env);
  const accountNumber = env.RAZORPAYX_ACCOUNT_NUMBER?.trim();
  return base && accountNumber ? { ...base, accountNumber } : null;
}

/** A person to pay, then the account to pay them at. Only the bank details go to Razorpay; we keep the last four digits. */
export async function createFundAccount(cfg: RazorpayConfig, o: { name: string; email: string; reference: string; ifsc: string; accountNumber: string }) {
  const contact = await call<{ id: string }>(cfg, "/contacts", { name: o.name.slice(0, 50), email: o.email, type: "vendor", reference_id: o.reference.slice(0, 40) });
  return call<{ id: string }>(cfg, "/fund_accounts", { contact_id: contact.id, account_type: "bank_account", bank_account: { name: o.name.slice(0, 100), ifsc: o.ifsc, account_number: o.accountNumber } });
}

/** Sends rupees from the RazorpayX account. The payout's own id is the idempotency key, so a double click can't pay twice. */
export async function createPayout(cfg: PayoutConfig, o: { fundAccountId: string; amount: number; mode: "IMPS" | "NEFT" | "UPI"; reference: string }) {
  return call<{ id: string; status: string }>(
    cfg,
    "/payouts",
    { account_number: cfg.accountNumber, fund_account_id: o.fundAccountId, amount: o.amount, currency: "INR", mode: o.mode, purpose: "payout", queue_if_low_balance: true, reference_id: o.reference.slice(0, 40), narration: "PowerProof payout" },
    { "X-Payout-Idempotency": o.reference }
  );
}
