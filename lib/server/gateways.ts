import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "@/lib/integrations";
import { siteUrl } from "@/lib/site-url";
import { CheckoutError } from "./checkout";
import { loadIntegration } from "./integrations";
import { createGatewayOrder, GatewayError, verifyPaymentSignature } from "./razorpay";

/**
 * A Pro store's own payment gateway, used instead of PowerProof's Razorpay. The money goes
 * straight to the creator's account, so these orders never enter their PowerProof balance and no
 * platform fee is taken (apply_direct_payment).
 *
 * - own_razorpay: Razorpay's window as usual, with the store's key; the signature is checked with its secret.
 * - stripe: Stripe Checkout. Confirmed when the buyer comes back (the session is read from Stripe)
 *   or by Stripe's webhook, whichever is first.
 * - custom: we POST the order to the gateway's create-payment URL (signed) and send the buyer to
 *   the link it answers with; the gateway tells us when it's paid (signed webhook).
 */

export const DIRECT_GATEWAYS = ["own_razorpay", "stripe", "custom"] as const;

export interface DirectGateway {
  provider: PaymentProvider;
  config: Record<string, string>;
  secrets: Record<string, string>;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The store's own gateway when it has one connected (and is on Pro), else null */
export async function directGatewayFor(storeId: string): Promise<DirectGateway | null> {
  const i = await loadIntegration(storeId, "payment");
  if (!i || !(DIRECT_GATEWAYS as readonly string[]).includes(i.provider)) return null;
  return { provider: i.provider as PaymentProvider, config: Object.fromEntries(Object.entries(i.config).map(([k, v]) => [k, str(v)])), secrets: i.secrets };
}

export const sign = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("hex");
export function signatureOk(secret: string, body: string, signature: string) {
  const a = Buffer.from(sign(secret, body));
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Where the buyer comes back to after paying on another site */
export const returnUrl = (gatewayOrderId: string) => `${siteUrl()}/api/checkout/return?o=${encodeURIComponent(gatewayOrderId)}`;

export type DirectStart = { gatewayOrderId: string; keyId?: string; redirect?: string; finish?: (orderId: string) => Promise<string | undefined> };

/**
 * Starts the payment before the order is saved (the order is saved with the id this returns).
 * Custom gateways are asked for their link afterwards (`finish`), since they need our order id.
 */
export async function startDirect(gw: DirectGateway, o: { ref: string; amount: number; currency: string; storeName: string; storeSlug: string; title: string; buyer: { name: string; email: string; phone: string } }): Promise<DirectStart> {
  if (gw.provider === "own_razorpay") {
    if (!gw.config.keyId || !gw.secrets.keySecret) throw new CheckoutError("This store's payments aren't set up yet. Please try again later.", 503);
    try {
      const order = await createGatewayOrder({ keyId: gw.config.keyId, keySecret: gw.secrets.keySecret }, { amount: o.amount, currency: o.currency, receipt: o.ref.replace(/\//g, "-"), notes: { store: o.storeSlug } });
      return { gatewayOrderId: order.id, keyId: gw.config.keyId };
    } catch (e) {
      throw new CheckoutError(e instanceof GatewayError ? e.message : "We couldn't start the payment. Please try again.", 502);
    }
  }

  if (gw.provider === "stripe") {
    if (!gw.secrets.secretKey) throw new CheckoutError("This store's payments aren't set up yet. Please try again later.", 503);
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": o.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(o.amount),
      "line_items[0][price_data][product_data][name]": o.title.slice(0, 200) || `Order ${o.ref}`,
      customer_email: o.buyer.email,
      client_reference_id: o.ref,
      "metadata[order_ref]": o.ref,
      "metadata[store]": o.storeSlug,
      success_url: `${siteUrl()}/api/checkout/return?o={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/s/${o.storeSlug}?payment=cancelled`,
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${gw.secrets.secretKey}`, "content-type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: { message?: string } };
    if (!res.ok || !json.id || !json.url) {
      console.error("[stripe] session failed", res.status, json.error?.message);
      throw new CheckoutError(json.error?.message ?? "We couldn't start the payment. Please try again.", 502);
    }
    return { gatewayOrderId: json.id, redirect: json.url };
  }

  // Custom: our own id now, the gateway's link once the order is saved
  if (!gw.config.createUrl?.startsWith("https://") || !gw.secrets.apiKey || !gw.secrets.webhookSecret) throw new CheckoutError("This store's payments aren't set up yet. Please try again later.", 503);
  const gatewayOrderId = `cus_${randomUUID()}`;
  return {
    gatewayOrderId,
    finish: async () => {
      const body = JSON.stringify({ orderId: gatewayOrderId, ref: o.ref, amount: o.amount, currency: o.currency, description: o.title, store: { name: o.storeName, slug: o.storeSlug }, buyer: o.buyer, returnUrl: returnUrl(gatewayOrderId), webhookUrl: `${siteUrl()}/api/webhooks/gateway?gw=custom` });
      const res = await fetch(gw.config.createUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${gw.secrets.apiKey}`, "x-powerproof-signature": sign(gw.secrets.webhookSecret, body) }, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) }).catch(() => null);
      const json = (await res?.json().catch(() => ({}))) as { paymentUrl?: string; message?: string } | undefined;
      if (!res?.ok || !json?.paymentUrl?.startsWith("https://")) {
        console.error("[gateway:custom] create failed", res?.status, json?.message);
        throw new CheckoutError("The store's payment provider didn't answer. You haven't been charged. Please try again.", 502);
      }
      return json.paymentUrl;
    },
  };
}

/** Razorpay (store's own account): the signature from the browser */
export function ownRazorpayPaid(gw: DirectGateway, gatewayOrderId: string, paymentId: string, signature: string) {
  return !!gw.secrets.keySecret && verifyPaymentSignature(gatewayOrderId, paymentId, signature, gw.secrets.keySecret);
}

/** Stripe: reads the Checkout Session; paid only when Stripe says so for the full amount */
export async function stripePaid(gw: DirectGateway, sessionId: string, total: number, currency: string): Promise<string | null> {
  if (!gw.secrets.secretKey) return null;
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { authorization: `Bearer ${gw.secrets.secretKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const s = (await res.json().catch(() => ({}))) as { payment_status?: string; amount_total?: number; currency?: string; payment_intent?: string };
  if (!res.ok || s.payment_status !== "paid" || s.amount_total !== total || s.currency?.toUpperCase() !== currency.toUpperCase()) return null;
  return s.payment_intent || sessionId;
}

/** Stripe's webhook signature: "t=<time>,v1=<hmac of time.body>", within five minutes */
export function stripeSignatureOk(secret: string, raw: string, header: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300 || !parts.v1) return false;
  return signatureOk(secret, `${t}.${raw}`, parts.v1);
}
