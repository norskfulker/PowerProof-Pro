import "server-only";
import { randomUUID } from "node:crypto";
import { dealRuleFrom } from "../api/live/map";
import { formatMoney } from "../money";
import { sbAdmin } from "../supabase/admin";
import type { Money, CurrencyCode } from "../types";
import { shippingFrom, type ShipTo } from "../shipping";
import { CheckoutError, priceOrder, type AskedLine, type CouponRow, type ProductRow } from "./checkout";
import { receiptMail, sendMail, shippedMail } from "./email";
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
  /** Physical products: the variant and how many of each */
  lines?: AskedLine[];
  coupon?: string;
  giftChoices?: Record<string, string>;
  bumpProductId?: string;
  buyer: { name: string; email: string; phone: string; country: string };
  /** Needed when something is shipped */
  shipTo?: ShipTo;
  /** "cod": cash on delivery */
  paymentMethod?: "online" | "cod";
}

export type CheckoutReply =
  | { free: true; orderId: string; token: string }
  | { free: false; cod: true; orderId: string; token: string }
  | { free: false; orderId: string; ref: string; keyId: string; gatewayOrderId: string; amount: number; currency: string; storeName: string };

interface CartInput {
  storeSlug: string;
  productIds: string[];
  lines?: AskedLine[];
  coupon?: string;
  giftChoices?: Record<string, string>;
  bumpProductId?: string;
  country: string;
  cod?: boolean;
}

/** Loads the store, its live products, deal rules and the code, and prices the cart. Nothing is written. */
async function priceCart(input: CartInput) {
  const db = sbAdmin();
  const { data: store } = await db.from("stores").select("id, name, status, currency_base, gstin, theme, shipping").eq("slug", input.storeSlug).maybeSingle();
  if (!store || store.status !== "published") throw new CheckoutError("This store isn't open for orders.", 404);

  const bumpCfg = (store.theme as { orderBump?: { productId: string; price: { amount: number } } } | null)?.orderBump;
  const bump = input.bumpProductId && bumpCfg && bumpCfg.productId === input.bumpProductId ? { productId: bumpCfg.productId, price: bumpCfg.price.amount } : undefined;
  const wanted = [...new Set([...input.productIds, ...(input.lines ?? []).map((l) => l.productId), ...(bump ? [bump.productId] : [])])];
  const { data: products } = await db.from("products").select("id, title, price_minor, hsn_sac, tax_rate_bps, fulfilment, track_stock, stock").eq("store_id", store.id).eq("status", "live").in("id", wanted);
  const { data: variants } = wanted.length ? await db.from("product_variants").select("id, product_id, title, price_minor, stock").in("product_id", wanted).order("sort_order") : { data: [] };
  const { data: ruleRows } = await db.from("deal_rules").select("*").eq("store_id", store.id).eq("active", true);

  let coupon: CouponRow | undefined;
  if (input.coupon?.trim()) {
    const { data } = await db.from("coupons").select("id, kind, value, min_subtotal_minor, product_id, max_uses, used_count, starts_at, ends_at, active").eq("store_id", store.id).eq("code", input.coupon.trim().toUpperCase()).maybeSingle();
    coupon = data ? ({ ...data, value: Number(data.value), min_subtotal_minor: data.min_subtotal_minor == null ? null : Number(data.min_subtotal_minor), kind: data.kind as CouponRow["kind"] } satisfies CouponRow) : undefined;
    if (!coupon) throw new CheckoutError("That code doesn't exist. Check the spelling.", 400, "coupon");
  }

  const priced = priceOrder({
    currency: asCurrency(store.currency_base),
    products: (products ?? []).map((p): ProductRow => ({
      ...p,
      price_minor: Number(p.price_minor),
      variants: (variants ?? []).filter((v) => v.product_id === p.id).map((v) => ({ id: v.id, title: v.title, price_minor: Number(v.price_minor), stock: v.stock })),
    })),
    productIds: input.productIds,
    lines: input.lines,
    shipping: shippingFrom(store.shipping),
    cod: input.cod,
    rules: (ruleRows ?? []).map(dealRuleFrom),
    giftChoices: input.giftChoices,
    bump,
    coupon,
    countryCode: input.country,
    registered: !!store.gstin,
  });
  return { store, priced };
}

export interface CheckoutQuote {
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  tax: number;
  total: number;
  currency: string;
  physical: boolean;
  /** The code's verdict, when one was typed */
  coupon?: { ok: boolean; message: string };
}

/** What the order comes to, priced exactly as checkout will price it. A bad code is reported, and the rest priced without it. */
export async function quoteCheckout(input: Omit<CartInput, "country"> & { country: string }): Promise<CheckoutQuote> {
  const out = (priced: Awaited<ReturnType<typeof priceCart>>["priced"], coupon?: CheckoutQuote["coupon"]): CheckoutQuote => ({
    subtotal: priced.subtotal,
    discount: priced.discount,
    shipping: priced.shipping,
    codFee: priced.codFee,
    tax: priced.tax,
    total: priced.total,
    currency: priced.currency,
    physical: priced.physical,
    coupon,
  });
  try {
    const { priced } = await priceCart(input);
    return out(priced, input.coupon?.trim() ? { ok: true, message: "Code applied." } : undefined);
  } catch (e) {
    if (e instanceof CheckoutError && e.scope === "coupon") {
      const { priced } = await priceCart({ ...input, coupon: undefined });
      return out(priced, { ok: false, message: e.message });
    }
    throw e;
  }
}

export async function createCheckout(input: CheckoutInput): Promise<CheckoutReply> {
  const db = sbAdmin();
  const cod = input.paymentMethod === "cod";
  // Shipped orders are priced (shipping and GST) for where they're going
  const { store, priced } = await priceCart({ ...input, country: input.shipTo?.country ?? input.buyer.country, cod });
  if (priced.physical && !input.shipTo) throw new CheckoutError("Add the address to send it to.");

  if (cod) {
    const { data: ref } = await db.rpc("gen_order_ref");
    const created = await db.rpc("create_order", {
      ...orderArgs(input, store.id, ref as string, priced),
      p_gateway_order_id: `cod_${randomUUID()}`,
      p_payment_method: "cod",
    });
    if (created.error || !created.data) {
      console.error("[checkout] COD create_order failed", created.error?.message);
      throw new CheckoutError("We couldn't place your order. Please try again.", 500);
    }
    const orderId = created.data as string;
    const t = await db.rpc("issue_download_token", { p_order: orderId });
    const token = (t.data as string | null) ?? "";
    await mailReceipt(orderId, token).catch((e) => console.error("[mail] COD receipt failed", e instanceof Error ? e.message : e));
    return { free: false, cod: true, orderId, token };
  }

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

  const created = await db.rpc("create_order", { ...orderArgs(input, store.id, orderRef, priced), p_gateway_order_id: gatewayOrderId, p_payment_method: "online" });
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

/** The order's details for create_order (the gateway id and payment method are added by the caller) */
function orderArgs(input: CheckoutInput, storeId: string, ref: string, priced: ReturnType<typeof priceOrder>) {
  return {
    p_ref: ref,
    p_store: storeId,
    p_name: input.buyer.name.trim(),
    p_email: input.buyer.email.trim().toLowerCase(),
    p_phone: input.buyer.phone.trim(),
    p_country: input.shipTo?.country ?? input.buyer.country,
    p_currency: priced.currency,
    p_subtotal: priced.subtotal,
    p_discount: priced.discount,
    p_tax: priced.tax,
    p_total: priced.total,
    p_deals: priced.dealIds as never,
    p_coupon: priced.couponId as string,
    p_items: priced.items as never,
    p_shipping: priced.shipping,
    p_cod_fee: priced.codFee,
    p_ship_to: (priced.physical && input.shipTo ? input.shipTo : null) as never,
  };
}

/** Marks the order paid (safe to call twice), emails the receipt, and returns a link token. */
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
    // The code's use is counted by the database when the order becomes paid (orders_coupon_use)
    await mailReceipt(row.out_order_id, token).catch((e) => console.error("[mail] receipt failed", e instanceof Error ? e.message : e));
  }
  return { orderId: row.out_order_id, ref: row.out_ref, token };
}

/** One line for an address in an email */
export const addressLine = (a: Partial<ShipTo> | null | undefined) => (a ? [a.name, a.line1, a.line2, a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ") : "");

export async function mailReceipt(orderId: string, token: string) {
  const db = sbAdmin();
  const { data: o } = await db.from("orders").select("ref, buyer_name, buyer_email, currency, total_minor, store_id, shipping_minor, cod_fee_minor, payment_method, ship_to").eq("id", orderId).single();
  if (!o) return;
  const [{ data: store }, { data: items }] = await Promise.all([db.from("stores").select("name, support_email").eq("id", o.store_id).single(), db.from("order_items").select("title, line_total_minor, quantity, variant_title, fulfilment").eq("order_id", orderId)]);
  const fmt = (n: number) => formatMoney(money(n, o.currency));
  const charges = [
    ...(o.ship_to ? [{ title: "Shipping", amount: Number(o.shipping_minor) ? fmt(Number(o.shipping_minor)) : "Free" }] : []),
    ...(Number(o.cod_fee_minor) ? [{ title: "Cash on delivery charge", amount: fmt(Number(o.cod_fee_minor)) }] : []),
  ];
  const mail = receiptMail({
    storeName: store?.name ?? "the store",
    buyerName: o.buyer_name,
    ref: o.ref,
    lines: (items ?? []).map((i) => ({ title: `${i.title}${i.variant_title ? ` (${i.variant_title})` : ""}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`, amount: fmt(Number(i.line_total_minor)) })),
    charges,
    total: fmt(Number(o.total_minor)),
    downloadUrl: `${siteUrl()}/order/${token}`,
    invoiceUrl: `${siteUrl()}/invoice/${orderId}?t=${token}`,
    supportEmail: store?.support_email ?? undefined,
    shipTo: addressLine(o.ship_to as Partial<ShipTo> | null) || undefined,
    cod: o.payment_method === "cod",
    files: (items ?? []).some((i) => i.fulfilment !== "physical"),
  });
  return sendMail({ to: String(o.buyer_email), ...mail });
}

/** Tells the buyer their parcel was sent (with tracking) or delivered */
export async function mailShipped(orderId: string, delivered: boolean) {
  const db = sbAdmin();
  const { data: o } = await db.from("orders").select("ref, buyer_name, buyer_email, currency, total_minor, store_id, status, tracking").eq("id", orderId).single();
  if (!o) return;
  const { data: store } = await db.from("stores").select("name, support_email").eq("id", o.store_id).single();
  const t = await db.rpc("issue_download_token", { p_order: orderId });
  const tr = (o.tracking ?? {}) as { carrier?: string; number?: string; url?: string };
  const mail = shippedMail({
    storeName: store?.name ?? "the store",
    buyerName: o.buyer_name,
    ref: o.ref,
    delivered,
    carrier: tr.carrier,
    number: tr.number,
    trackUrl: tr.url,
    orderUrl: `${siteUrl()}/order/${(t.data as string | null) ?? ""}`,
    supportEmail: store?.support_email ?? undefined,
    cod: o.status === "cod" ? formatMoney(money(Number(o.total_minor), o.currency)) : undefined,
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
  // Free orders had no payment, and cash on delivery is handed back by the seller
  if (o.gateway_payment_id && !o.gateway_payment_id.startsWith("free_") && !o.gateway_payment_id.startsWith("cod_")) {
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
