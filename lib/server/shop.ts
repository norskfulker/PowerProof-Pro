import "server-only";
import { randomUUID } from "node:crypto";
import { dealRuleFrom } from "../api/live/map";
import { formatMoney } from "../money";
import { sbAdmin } from "../supabase/admin";
import type { Money, CurrencyCode } from "../types";
import { CheckoutError, priceOrder, type CouponRow } from "./checkout";
import { receiptMail, sendMail } from "./email";
import { createGatewayOrder, GatewayError, razorpayConfig, refundPayment } from "./razorpay";

/**
 * Everything that touches money or private files, on the server with the service-role key.
 * Callers (route handlers) have already checked who is asking.
 */
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const asCurrency = (c: string): CurrencyCode => (["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"].includes(c) ? (c as CurrencyCode) : "INR");
const money = (amount: number, currency: string): Money => ({ amount, currency: asCurrency(currency) });

export interface CheckoutInput {
  storeSlug: string;
  productIds: string[];
  coupon?: string;
  giftChoices?: Record<string, string>;
  bumpProductId?: string;
  buyer: { name: string; email: string; phone: string; country: string };
}

export type CheckoutReply =
  | { free: true; orderId: string; token: string }
  | { free: false; orderId: string; ref: string; keyId: string; gatewayOrderId: string; amount: number; currency: string; storeName: string };

interface CartInput {
  storeSlug: string;
  productIds: string[];
  coupon?: string;
  giftChoices?: Record<string, string>;
  bumpProductId?: string;
  country: string;
}

/** Loads the store, its live products, deal rules and the code, and prices the cart. Nothing is written. */
async function priceCart(input: CartInput) {
  const db = sbAdmin();
  const { data: store } = await db.from("stores").select("id, name, status, currency_base, gstin, theme").eq("slug", input.storeSlug).maybeSingle();
  if (!store || store.status !== "published") throw new CheckoutError("This store isn't open for orders.", 404);

  const bumpCfg = (store.theme as { orderBump?: { productId: string; price: { amount: number } } } | null)?.orderBump;
  const bump = input.bumpProductId && bumpCfg && bumpCfg.productId === input.bumpProductId ? { productId: bumpCfg.productId, price: bumpCfg.price.amount } : undefined;
  const wanted = [...new Set([...input.productIds, ...(bump ? [bump.productId] : [])])];
  const { data: products } = await db.from("products").select("id, title, price_minor, hsn_sac, tax_rate_bps").eq("store_id", store.id).eq("status", "live").in("id", wanted);
  const { data: ruleRows } = await db.from("deal_rules").select("*").eq("store_id", store.id).eq("active", true);

  let coupon: CouponRow | undefined;
  if (input.coupon?.trim()) {
    const { data } = await db.from("coupons").select("id, kind, value, min_subtotal_minor, product_id, max_uses, used_count, starts_at, ends_at, active").eq("store_id", store.id).eq("code", input.coupon.trim().toUpperCase()).maybeSingle();
    coupon = data ? ({ ...data, value: Number(data.value), min_subtotal_minor: data.min_subtotal_minor == null ? null : Number(data.min_subtotal_minor), kind: data.kind as CouponRow["kind"] } satisfies CouponRow) : undefined;
    if (!coupon) throw new CheckoutError("That code doesn't exist. Check the spelling.", 400, "coupon");
  }

  const priced = priceOrder({
    currency: asCurrency(store.currency_base),
    products: (products ?? []).map((p) => ({ ...p, price_minor: Number(p.price_minor) })),
    productIds: input.productIds,
    rules: (ruleRows ?? []).map(dealRuleFrom),
    giftChoices: input.giftChoices,
    bump,
    coupon,
    countryCode: input.country,
    registered: !!store.gstin,
  });
  return { store, priced };
}

export async function createCheckout(input: CheckoutInput): Promise<CheckoutReply> {
  const db = sbAdmin();
  const { store, priced } = await priceCart({ ...input, country: input.buyer.country });

  const { data: ref } = await db.rpc("gen_order_ref");
  const orderRef = ref as string;
  const free = priced.total === 0;
  const cfg = razorpayConfig();
  if (!free && !cfg) throw new CheckoutError("Payments aren't connected for this store yet. Please check back shortly.", 503);
  if (!free && priced.total < 100) throw new CheckoutError("That total is too small to charge. Add something else.");

  let gatewayOrderId = `free_${randomUUID()}`;
  if (!free && cfg) {
    try {
      gatewayOrderId = (await createGatewayOrder(cfg, { amount: priced.total, currency: priced.currency, receipt: orderRef.replace(/\//g, "-"), notes: { store: input.storeSlug } })).id;
    } catch (e) {
      throw new CheckoutError(e instanceof GatewayError ? e.message : "We couldn't start the payment. Please try again.", 502);
    }
  }

  const created = await db.rpc("create_order", {
    p_ref: orderRef,
    p_store: store.id,
    p_name: input.buyer.name.trim(),
    p_email: input.buyer.email.trim().toLowerCase(),
    p_phone: input.buyer.phone.trim(),
    p_country: input.buyer.country,
    p_currency: priced.currency,
    p_subtotal: priced.subtotal,
    p_discount: priced.discount,
    p_tax: priced.tax,
    p_total: priced.total,
    p_deals: priced.dealIds as never,
    p_coupon: priced.couponId as string,
    p_gateway_order_id: gatewayOrderId,
    p_items: priced.items as never,
  });
  if (created.error || !created.data) {
    console.error("[checkout] create_order failed", created.error?.message);
    throw new CheckoutError("We couldn't save your order. Please try again.", 500);
  }
  const orderId = created.data as string;

  if (free) {
    const done = await completePayment(gatewayOrderId, `free_${orderId}`);
    return { free: true, orderId, token: done.token };
  }
  return { free: false, orderId, ref: orderRef, keyId: cfg!.keyId, gatewayOrderId, amount: priced.total, currency: priced.currency, storeName: store.name };
}

/** Marks the order paid (safe to call twice), uses up a coupon, emails the receipt, and returns a link token. */
export async function completePayment(gatewayOrderId: string, paymentId: string, feeMinor?: number): Promise<{ orderId: string; ref: string; token: string }> {
  const db = sbAdmin();
  const r = await db.rpc("apply_payment", { p_gateway_order_id: gatewayOrderId, p_gateway_payment_id: paymentId, p_gateway_fee_minor: feeMinor as number });
  if (r.error || !r.data?.[0]) throw new CheckoutError(r.error?.message.includes("order_not_found") ? "We can't find that order." : "We couldn't confirm that payment.", 400);
  const row = r.data[0] as { out_order_id: string; out_ref: string; out_token: string | null; out_already_paid: boolean };
  let token = row.out_token;
  if (!token) {
    const t = await db.rpc("issue_download_token", { p_order: row.out_order_id });
    token = (t.data as string | null) ?? "";
  }
  if (!row.out_already_paid) {
    const { data: o } = await db.from("orders").select("coupon_id").eq("id", row.out_order_id).single();
    if (o?.coupon_id) {
      const { data: c } = await db.from("coupons").select("used_count").eq("id", o.coupon_id).single();
      await db.from("coupons").update({ used_count: (c?.used_count ?? 0) + 1 }).eq("id", o.coupon_id);
    }
    await mailReceipt(row.out_order_id, token).catch((e) => console.error("[mail] receipt failed", e instanceof Error ? e.message : e));
  }
  return { orderId: row.out_order_id, ref: row.out_ref, token };
}

export async function mailReceipt(orderId: string, token: string) {
  const db = sbAdmin();
  const { data: o } = await db.from("orders").select("ref, buyer_name, buyer_email, currency, total_minor, store_id").eq("id", orderId).single();
  if (!o) return;
  const [{ data: store }, { data: items }] = await Promise.all([db.from("stores").select("name, support_email").eq("id", o.store_id).single(), db.from("order_items").select("title, line_total_minor").eq("order_id", orderId)]);
  const mail = receiptMail({
    storeName: store?.name ?? "the store",
    buyerName: o.buyer_name,
    ref: o.ref,
    lines: (items ?? []).map((i) => ({ title: i.title, amount: formatMoney(money(Number(i.line_total_minor), o.currency)) })),
    total: formatMoney(money(Number(o.total_minor), o.currency)),
    downloadUrl: `${siteUrl()}/order/${token}`,
    invoiceUrl: `${siteUrl()}/invoice/${orderId}?t=${token}`,
    supportEmail: store?.support_email ?? undefined,
  });
  return sendMail({ to: String(o.buyer_email), ...mail });
}

/** A short-lived link to one file, after counting the download */
export async function downloadLink(token: string, fileId: string): Promise<string | null> {
  const db = sbAdmin();
  const claim = await db.rpc("claim_download", { p_token: token, p_file: fileId });
  const row = claim.data?.[0];
  if (claim.error || !row) return claim.error?.message.includes("download_limit") ? "limit" : null;
  const signed = await db.storage.from("product-files").createSignedUrl(row.storage_path, 60, { download: row.file_name });
  return signed.data?.signedUrl ?? null;
}

/** Gives the money back (when it was paid through the gateway) and closes the order's books */
export async function refundOrder(orderId: string, reason: string): Promise<void> {
  const db = sbAdmin();
  const { data: o } = await db.from("orders").select("status, total_minor, currency, gateway_payment_id, ref").eq("id", orderId).single();
  if (!o) throw new CheckoutError("We can't find that order.", 404);
  if (o.status === "refunded") return;
  if (o.status !== "paid") throw new CheckoutError("Only a paid order can be refunded.");
  let refundId = `free_refund_${randomUUID()}`;
  if (o.gateway_payment_id && !o.gateway_payment_id.startsWith("free_")) {
    const cfg = razorpayConfig();
    if (!cfg) throw new CheckoutError("Payments aren't connected, so this can't be refunded here.", 503);
    try {
      refundId = (await refundPayment(cfg, o.gateway_payment_id, { amount: Number(o.total_minor), reason, receipt: `rf-${o.ref.replace(/\//g, "-")}` })).id;
    } catch (e) {
      throw new CheckoutError(e instanceof GatewayError ? e.message : "The refund didn't go through.", 502);
    }
  }
  const r = await db.rpc("apply_refund", { p_order: orderId, p_gateway_refund_id: refundId, p_reason: reason });
  if (r.error) throw new CheckoutError("The money was refunded, but we couldn't update the order. Contact support.", 500);
}
