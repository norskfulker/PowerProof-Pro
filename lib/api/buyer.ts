import { feeBreakdown, localPrice, money } from "../money";
import { commit, db } from "../mock/db";
import { uid } from "../mock/random";
import type { CurrencyCode, Order, Product, Store, TrafficSource } from "../types";
import { ApiError, call, notFound } from "./client";

/** Public store data. No creator-only fields leave here. */
export interface PublicStore {
  store: Store;
  products: Product[];
}

export function getStorefront(slug: string): Promise<PublicStore> {
  return call(() => {
    const d = db();
    if (d.store.slug !== slug) notFound("Store");
    return { store: d.store, products: d.products.filter((p) => p.status === "published") };
  });
}

export function getPublicProduct(storeSlug: string, productSlug: string): Promise<{ store: Store; product: Product; more: Product[] }> {
  return call(() => {
    const d = db();
    if (d.store.slug !== storeSlug) notFound("Store");
    const product = d.products.find((p) => p.slug === productSlug && p.status === "published") ?? notFound("Product");
    const more = d.products.filter((p) => p.status === "published" && p.id !== product.id).slice(0, 3);
    return { store: d.store, product, more };
  });
}

const COUNTRY_BY_CURRENCY: Record<CurrencyCode, [string, string]> = {
  INR: ["India", "IN"],
  USD: ["United States", "US"],
  EUR: ["Germany", "DE"],
  GBP: ["United Kingdom", "GB"],
  AED: ["United Arab Emirates", "AE"],
  SGD: ["Singapore", "SG"],
  AUD: ["Australia", "AU"],
  CAD: ["Canada", "CA"],
};

/** Creates a pending order when the buyer taps Buy. */
export function startCheckout(productId: string, currency: CurrencyCode, source: TrafficSource = "direct"): Promise<Order> {
  return call(() => {
    const d = db();
    const product = d.products.find((p) => p.id === productId) ?? notFound("Product");
    const fees = feeBreakdown(product.price);
    const n = 1042 + d.orders.length + Math.floor(Math.random() * 50) + 100;
    const [country, cc] = COUNTRY_BY_CURRENCY[currency];
    const order: Order = {
      id: uid("ord"),
      number: `PP-${n}`,
      productId: product.id,
      productTitle: product.title,
      customerId: "",
      buyerName: "",
      buyerEmail: "",
      country,
      countryCode: cc,
      buyerTotal: localPrice(product.price, currency),
      total: product.price,
      fees: { gateway: fees.gateway, platform: fees.platform },
      net: fees.keep,
      status: "pending",
      source,
      downloads: 0,
      paymentMethod: currency === "INR" ? "upi" : "card",
      createdAt: new Date().toISOString(),
    };
    commit((x) => x.orders.unshift(order));
    return order;
  });
}

export interface PayInput {
  orderId: string;
  name: string;
  email: string;
  method: Order["paymentMethod"];
  /** Demo hook: force the payment to fail. */
  simulateFailure?: boolean;
}

/** Mock payment. In production this is Razorpay Checkout + a signed webhook. */
export function payOrder(input: PayInput): Promise<Order> {
  return call(async () => {
    await new Promise((r) => setTimeout(r, 900));
    const d = db();
    const o = d.orders.find((x) => x.id === input.orderId) ?? notFound("Order");
    if (o.status === "paid") return o;
    if (input.simulateFailure) {
      throw new ApiError("Your bank declined the payment. No money was taken. Try another method.", "validation");
    }
    commit(() => {
      const email = input.email.trim().toLowerCase();
      let c = d.customers.find((x) => x.email === email);
      if (!c) {
        c = {
          id: uid("cus"),
          name: input.name.trim(),
          email,
          country: o.country,
          countryCode: o.countryCode,
          currency: o.buyerTotal.currency,
          ordersCount: 0,
          totalSpent: money(0),
          firstOrderAt: new Date().toISOString(),
          lastOrderAt: new Date().toISOString(),
        };
        d.customers.unshift(c);
      }
      c.ordersCount += 1;
      c.totalSpent = money(c.totalSpent.amount + o.total.amount);
      c.lastOrderAt = new Date().toISOString();

      o.customerId = c.id;
      o.buyerName = c.name;
      o.buyerEmail = email;
      o.paymentMethod = input.method;
      o.status = "paid";
      o.paidAt = new Date().toISOString();
      o.invoiceNumber = `${d.invoice.prefix}-${String(d.invoice.nextNumber).padStart(4, "0")}`;
      d.invoice.nextNumber += 1;

      const p = d.products.find((x) => x.id === o.productId);
      if (p) {
        p.salesCount += 1;
        p.revenue = money(p.revenue.amount + o.total.amount);
      }
      d.notifications.unshift({
        id: uid("n"),
        kind: "sale",
        title: "New sale",
        body: `${c.name} bought ${o.productTitle}`,
        createdAt: new Date().toISOString(),
        read: false,
        href: `/orders/${o.id}`,
      });
    });
    return o;
  });
}

export interface Delivery {
  order: Order;
  product: Product;
  store: Store;
}

export function getDelivery(orderId: string): Promise<Delivery> {
  return call(() => {
    const d = db();
    const order = d.orders.find((o) => o.id === orderId) ?? notFound("Order");
    const product = d.products.find((p) => p.id === order.productId) ?? notFound("Product");
    return { order, product, store: d.store };
  });
}

export function recordDownload(orderId: string): Promise<void> {
  return call(() => {
    commit((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (o) o.downloads += 1;
    });
  }, { fast: true });
}

export function lookupOrders(email: string, orderNumber?: string): Promise<Order[]> {
  return call(() => {
    const e = email.trim().toLowerCase();
    const n = orderNumber?.trim().toUpperCase();
    return db().orders.filter(
      (o) => o.buyerEmail === e && (o.status === "paid" || o.status === "refund_requested" || o.status === "refunded") && (!n || o.number === n)
    );
  });
}

export function requestRefund(orderId: string, reason: string): Promise<Order> {
  return call(() => {
    const d = db();
    const o = d.orders.find((x) => x.id === orderId) ?? notFound("Order");
    if (o.status !== "paid") throw new ApiError("This order can't be refunded from here. Write to the creator instead.", "conflict");
    commit(() => {
      o.status = "refund_requested";
      o.refundReason = reason;
    });
    return o;
  });
}
