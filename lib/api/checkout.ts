import { feeBreakdown, localPrice, money } from "../money";
import { commit, db } from "../mock/db";
import type { StoreScope } from "../mock/base";
import { uid } from "../mock/random";
import { bundleTotals, checkCoupon, priceInfo, ratingSummary } from "../pricing";
import { evaluateDeals, isRuleLive, type DealResult } from "../pricing/deals";
import type { CurrencyCode, DealRule, Order, OrderItem, PriceInfo, Product, RatingSummary, Store, StoreDesign, TrafficSource } from "../types";
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

/** Runs deal paths over the buyer's items and adds. Bundle orders are already discounted, so they skip deals. */
export function dealsFor(order: Order, scope: StoreScope, now = Date.now()): DealResult | undefined {
  if (order.bundleId) return undefined;
  const products = scope.products.filter((p) => p.status === "published");
  const base = order.items.filter((i) => i.kind === "product" || i.kind === "bump");
  return evaluateDeals({
    lines: [
      ...base.map((i) => (i.kind === "bump" ? { productId: i.productId, price: i.basePrice ?? i.price, locked: true } : { productId: i.productId })),
      ...(order.dealAdds ?? []).map((productId) => ({ productId })),
    ],
    rules: scope.dealRules,
    products: products.map((p) => ({ id: p.id, title: p.title, price: priceInfo(p, scope.deals, now).price, floor: p.priceFloor })),
    giftChoices: order.giftChoices,
    now,
  });
}

/** Recomputes deal lines, discount, totals and fees from the order's items, deal adds and coupon. */
function reprice(order: Order, scope: StoreScope) {
  const deals = dealsFor(order, scope);
  if (deals) {
    const baseKinds = order.items.filter((i) => i.kind === "product" || i.kind === "bump").map((i) => i.kind);
    order.items = deals.lines.map((l, i) => ({
      productId: l.productId,
      title: l.title,
      price: l.price,
      kind: i < baseKinds.length ? baseKinds[i] : "deal",
      basePrice: l.price.amount !== l.basePrice.amount ? l.basePrice : undefined,
      free: l.free || undefined,
      gift: l.gift || undefined,
      ruleIds: l.ruleIds.length ? l.ruleIds : undefined,
    }));
    order.dealRuleIds = deals.appliedRuleIds.length ? deals.appliedRuleIds : undefined;
    order.dealSaving = deals.saving.amount ? deals.saving : undefined;
  }
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

export interface DealCardProduct extends Product {
  info: PriceInfo;
  rating: RatingSummary;
}

export interface CheckoutDeals {
  /** Offers, best first. The panel shows three and a "See more". */
  offers: DealResult["offers"];
  pendingChoices: string[];
  saving: Order["total"];
  rules: DealRule[];
  /** Every product an offer, gift picker or buyer add mentions, with buyer-facing price info */
  products: DealCardProduct[];
  skipped: boolean;
}

export interface CheckoutView {
  order: Order;
  store: Store;
  design: StoreDesign;
  products: Product[];
  bump?: { product: Product; price: Order["total"]; label: string };
  deals?: CheckoutDeals;
}

function dealView(scope: StoreScope, order: Order): CheckoutDeals | undefined {
  const now = Date.now();
  const res = dealsFor(order, scope, now);
  if (!res) return undefined;
  const live = scope.dealRules.filter((r) => isRuleLive(r, now));
  if (!live.length) return undefined;
  const mentioned = new Set<string>([...res.offers.flatMap((o) => [...o.addProductIds, ...(o.giftOptions ?? [])]), ...(order.dealAdds ?? []), ...order.items.filter((i) => i.gift).map((i) => i.productId)]);
  return {
    offers: res.offers,
    pendingChoices: res.pendingChoices,
    saving: res.saving,
    rules: live,
    products: scope.products
      .filter((p) => mentioned.has(p.id))
      .map((p) => ({ ...p, info: priceInfo(p, scope.deals, now), rating: ratingSummary(scope.reviews.filter((r) => r.productId === p.id)) })),
    skipped: !!order.dealsSkipped,
  };
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
    deals: order.status === "pending" ? dealView(scope, order) : undefined,
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
  /** Zero-total order (100% coupon or free product): no gateway, deliver straight away */
  free?: boolean;
}

/** Mock payment. In production this is the gateway's checkout plus a signed webhook. */
export function payOrder(input: PayInput): Promise<Order> {
  return call(async () => {
    const { scope, order: o } = findOrder((x) => x.id === input.orderId);
    if (input.free && o.buyerTotal.amount !== 0) throw new ApiError("This order isn't free any more. Check the total and pay to continue.", "validation");
    if (!input.free) await new Promise((r) => setTimeout(r, 900));
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
      // Deal paths stats: a use per applied rule, and the revenue from items the buyer added
      const lift = o.items.filter((i) => i.kind === "deal" && !i.gift).reduce((t, i) => t + i.price.amount, 0);
      for (const r of scope.dealRules) {
        if (!o.dealRuleIds?.includes(r.id)) continue;
        r.stats.uses += 1;
        r.stats.revenueLift = money(r.stats.revenueLift.amount + Math.round(lift / o.dealRuleIds.length));
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

/** Deal paths panel: add or remove a suggested product, pick a gift, or skip. Never adds anything by itself. */
export function updateDeals(
  orderId: string,
  change: { add: string } | { remove: string } | { gift: { ruleId: string; productId: string } } | { skip: boolean }
): Promise<CheckoutView> {
  return call(() => {
    const { scope, order } = findOrder((o) => o.id === orderId);
    if (order.status !== "pending") throw new ApiError("This order is already paid.", "conflict");
    if (order.bundleId) throw new ApiError("Bundles already include their discount.", "conflict");
    commit(() => {
      if ("add" in change) {
        const p = scope.products.find((x) => x.id === change.add && x.status === "published") ?? notFound("Product");
        const inOrder = order.items.some((i) => i.productId === p.id && !i.gift) || order.dealAdds?.includes(p.id);
        if (!inOrder) order.dealAdds = [...(order.dealAdds ?? []), p.id];
        order.dealsSkipped = false;
      } else if ("remove" in change) {
        order.dealAdds = (order.dealAdds ?? []).filter((id) => id !== change.remove);
      } else if ("gift" in change) {
        const r = scope.dealRules.find((x) => x.id === change.gift.ruleId);
        if (!r || r.kind !== "choose_gift" || !r.giftIds.includes(change.gift.productId)) throw new ApiError("That gift isn't available.", "validation");
        order.giftChoices = { ...order.giftChoices, [r.id]: change.gift.productId };
      } else {
        order.dealsSkipped = change.skip;
      }
      reprice(order, scope);
    });
    return checkoutView(scope, order);
  }, { fast: true });
}

/** Counts a panel view for each offered rule, once per checkout visit. */
export function trackDealViews(orderId: string, ruleIds: string[]): Promise<void> {
  return call(() => {
    const { scope } = findOrder((o) => o.id === orderId);
    commit(() => {
      for (const r of scope.dealRules) if (ruleIds.includes(r.id)) r.stats.views += 1;
    });
  }, { fast: true });
}
