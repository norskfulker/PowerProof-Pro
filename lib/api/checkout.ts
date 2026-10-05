import { feeBreakdown, localPrice, money } from "../money";
import { commit, db } from "../mock/db";
import type { StoreScope } from "../mock/base";
import { uid } from "../mock/random";
import { bundleTotals, checkCoupon, priceInfo } from "../pricing";
import type { CurrencyCode, Order, OrderItem, Product, Store, StoreDesign, TrafficSource } from "../types";
import { ApiError, call, notFound } from "./client";
import { findOrder, isPrimary, scopeBySlug } from "./scope";

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

/** Recomputes discount, totals and fees from the order's items and coupon. */
function reprice(order: Order, scope: StoreScope) {
  const subtotal = order.items.reduce((t, i) => t + i.price.amount, 0);
  let discount = 0;
  if (order.couponCode) {
    const c = scope.coupons.find((x) => x.code === order.couponCode);
    const check = checkCoupon(c, order.items);
    if (check.ok) discount = check.discount.amount;
    else order.couponCode = undefined;
  }
  const total = subtotal - discount;
  const cur = order.buyerTotal.currency;
  const localSub = order.items.reduce((t, i) => t + localPrice(i.price, cur).amount, 0);
  const localDiscount = subtotal ? Math.round((discount * localSub) / subtotal) : 0;
  order.discount = discount ? money(discount) : undefined;
  order.total = money(total);
  order.buyerTotal = money(localSub - localDiscount, cur);
  const f = feeBreakdown(order.total);
  order.fees = { gateway: f.gateway, platform: f.platform };
  order.net = f.keep;
}

function itemFor(p: Product, scope: StoreScope, kind: OrderItem["kind"] = "product"): OrderItem {
  return { productId: p.id, title: p.title, price: priceInfo(p, scope.deals).price, kind };
}

export function startCheckout(slug: string, what: { productId: string } | { bundleId: string }, currency: CurrencyCode, source: TrafficSource = "direct"): Promise<Order> {
  return call(() => {
    const scope = scopeBySlug(slug);
    let items: OrderItem[];
    let bundleId: string | undefined;
    if ("bundleId" in what) {
      const b = scope.bundles.find((x) => x.id === what.bundleId && x.active) ?? notFound("Bundle");
      const ps = b.productIds.map((id) => scope.products.find((p) => p.id === id)).filter(Boolean) as Product[];
      const totals = bundleTotals(b, ps, scope.deals);
      // Spread the bundle price across its items so invoices and refunds stay per product
      const ratio = totals.price.amount / (totals.full.amount || 1);
      items = ps.map((p) => ({ ...itemFor(p, scope, "bundle"), price: money(Math.round(priceInfo(p, scope.deals).price.amount * ratio)) }));
      bundleId = b.id;
    } else {
      const p = scope.products.find((x) => x.id === what.productId && x.status === "published") ?? notFound("Product");
      items = [itemFor(p, scope)];
    }
    const [country, cc] = COUNTRY_BY_CURRENCY[currency];
    const n = 2000 + Math.floor(Math.random() * 7000);
    const order: Order = {
      id: uid("ord"),
      token: uid("tok") + uid("x").slice(2),
      storeId: scope.store.id,
      number: `PP-${n}`,
      productId: items[0].productId,
      productTitle: bundleId ? scope.bundles.find((b) => b.id === bundleId)!.name : items[0].title,
      customerId: "",
      buyerName: "",
      buyerEmail: "",
      country,
      countryCode: cc,
      buyerTotal: money(0, currency),
      total: money(0),
      fees: { gateway: money(0), platform: money(0) },
      net: money(0),
      status: "pending",
      source,
      downloads: 0,
      paymentMethod: currency === "INR" ? "upi" : "card",
      createdAt: new Date().toISOString(),
      items,
      bundleId,
    };
    reprice(order, scope);
    commit(() => scope.orders.unshift(order));
    return order;
  });
}

export interface CheckoutView {
  order: Order;
  store: Store;
  design: StoreDesign;
  products: Product[];
  bump?: { product: Product; price: Order["total"]; label: string };
}

function checkoutView(scope: StoreScope, order: Order): CheckoutView {
  const ids = new Set(order.items.map((i) => i.productId));
  const b = scope.design.orderBump;
  const bumpProduct = b && scope.products.find((p) => p.id === b.productId && p.status === "published");
  return {
    order,
    store: scope.store,
    design: scope.design,
    products: scope.products.filter((p) => ids.has(p.id)),
    bump: b && bumpProduct && !order.items.some((i) => i.kind !== "bump" && i.productId === bumpProduct.id) ? { product: bumpProduct, price: b.price, label: b.label } : undefined,
  };
}

export function getCheckout(orderId: string): Promise<CheckoutView> {
  return call(() => {
    const { scope, order } = findOrder((o) => o.id === orderId);
    return checkoutView(scope, order);
  });
}

export function applyCoupon(orderId: string, code: string): Promise<CheckoutView> {
  return call(() => {
    const { scope, order } = findOrder((o) => o.id === orderId);
    const c = scope.coupons.find((x) => x.code.toUpperCase() === code.trim().toUpperCase());
    const check = checkCoupon(c, order.items);
    if (!check.ok) throw new ApiError(check.error, "validation");
    commit(() => {
      order.couponCode = c!.code;
      reprice(order, scope);
    });
    return checkoutView(scope, order);
  });
}

export function removeCoupon(orderId: string): Promise<CheckoutView> {
  return call(() => {
    const { scope, order } = findOrder((o) => o.id === orderId);
    commit(() => {
      order.couponCode = undefined;
      reprice(order, scope);
    });
    return checkoutView(scope, order);
  }, { fast: true });
}

export function setOrderBump(orderId: string, on: boolean): Promise<CheckoutView> {
  return call(() => {
    const { scope, order } = findOrder((o) => o.id === orderId);
    const b = scope.design.orderBump;
    const p = b && scope.products.find((x) => x.id === b.productId);
    if (!b || !p) throw new ApiError("That add-on isn't available any more.", "conflict");
    commit(() => {
      order.items = order.items.filter((i) => i.kind !== "bump");
      if (on) order.items.push({ productId: p.id, title: p.title, price: b.price, kind: "bump" });
      reprice(order, scope);
    });
    return checkoutView(scope, order);
  }, { fast: true });
}

export interface PayInput {
  orderId: string;
  name: string;
  email: string;
  phone: string;
  method: Order["paymentMethod"];
  simulateFailure?: boolean;
}

/** Mock payment. In production this is the gateway's checkout plus a signed webhook. */
export function payOrder(input: PayInput): Promise<Order> {
  return call(async () => {
    await new Promise((r) => setTimeout(r, 900));
    const { scope, order: o } = findOrder((x) => x.id === input.orderId);
    if (o.status === "paid") return o;
    if (input.simulateFailure) throw new ApiError("Your bank declined the payment. No money was taken. Try another method.", "validation");
    commit(() => {
      const email = input.email.trim().toLowerCase();
      let c = scope.customers.find((x) => x.email === email);
      if (!c) {
        c = { id: uid("cus"), name: input.name.trim(), email, country: o.country, countryCode: o.countryCode, currency: o.buyerTotal.currency, ordersCount: 0, totalSpent: money(0), firstOrderAt: new Date().toISOString(), lastOrderAt: new Date().toISOString() };
        scope.customers.unshift(c);
      }
      c.ordersCount += 1;
      c.totalSpent = money(c.totalSpent.amount + o.total.amount);
      c.lastOrderAt = new Date().toISOString();
      Object.assign(o, {
        customerId: c.id,
        buyerName: c.name,
        buyerEmail: email,
        buyerPhone: input.phone,
        paymentMethod: input.method,
        status: "paid",
        paidAt: new Date().toISOString(),
        invoiceNumber: `${scope.invoice.prefix}-${String(scope.invoice.nextNumber).padStart(4, "0")}`,
      });
      scope.invoice.nextNumber += 1;
      if (o.couponCode) {
        const cp = scope.coupons.find((x) => x.code === o.couponCode);
        if (cp) cp.used += 1;
      }
      for (const it of o.items) {
        const p = scope.products.find((x) => x.id === it.productId);
        if (p) {
          p.salesCount += 1;
          p.revenue = money(p.revenue.amount + it.price.amount);
        }
      }
      if (isPrimary(scope)) {
        db().notifications.unshift({ id: uid("n"), kind: "sale", title: "New sale", body: `${c.name} bought ${o.productTitle}`, createdAt: new Date().toISOString(), read: false, href: `/orders/${o.id}` });
      }
    });
    return o;
  });
}
