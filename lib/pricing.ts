import { money } from "./money";
import type { Bundle, Coupon, Deal, Money, OrderItem, PriceInfo, Product, RatingSummary, Review } from "./types";

export function isDealLive(d: Deal, now = Date.now()): boolean {
  return Date.parse(d.startsAt) <= now && now < Date.parse(d.endsAt);
}

export function liveDealFor(productId: string, deals: Deal[], now = Date.now()): Deal | undefined {
  return deals.find((d) => isDealLive(d, now) && (d.productIds.length === 0 || d.productIds.includes(productId)));
}

/** What a product sells for right now, after any live deal. Store currency. */
export function priceInfo(p: Product, deals: Deal[], now = Date.now()): PriceInfo {
  const deal = liveDealFor(p.id, deals, now);
  if (deal) {
    const price = money(Math.round((p.price.amount * (100 - deal.percentOff)) / 100), p.price.currency);
    return { price, compareAt: p.price, percentOff: deal.percentOff, dealEndsAt: deal.endsAt };
  }
  if (p.compareAt && p.compareAt.amount > p.price.amount) {
    return { price: p.price, compareAt: p.compareAt, percentOff: Math.round((1 - p.price.amount / p.compareAt.amount) * 100) };
  }
  return { price: p.price };
}

export function bundleTotals(b: Bundle, products: Product[], deals: Deal[]): { full: Money; price: Money; percentOff: number } {
  const items = b.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
  const full = items.reduce((t, p) => t + priceInfo(p, deals).price.amount, 0);
  const price = b.pricing.kind === "price" ? b.pricing.price.amount : Math.round((full * (100 - b.pricing.percent)) / 100);
  return { full: money(full), price: money(price), percentOff: full ? Math.round((1 - price / full) * 100) : 0 };
}

export type CouponCheck = { ok: true; discount: Money; label: string } | { ok: false; error: string };

/** Validates a code against the items in an order. All amounts in store currency. */
export function checkCoupon(c: Coupon | undefined, items: OrderItem[], now = Date.now()): CouponCheck {
  if (!c || !c.active) return { ok: false, error: "That code doesn't exist. Check the spelling." };
  if (c.expiresAt && Date.parse(c.expiresAt) < now) return { ok: false, error: "That code has expired." };
  if (c.usageLimit !== undefined && c.used >= c.usageLimit) return { ok: false, error: "That code has been used up." };
  const eligible = c.scope === "store" ? items : items.filter((i) => c.productIds.includes(i.productId));
  if (eligible.length === 0) return { ok: false, error: "That code doesn't apply to this product." };
  const base = eligible.reduce((t, i) => t + i.price.amount, 0);
  const subtotal = items.reduce((t, i) => t + i.price.amount, 0);
  if (c.minSpend && subtotal < c.minSpend.amount) {
    return { ok: false, error: `Spend at least ₹${(c.minSpend.amount / 100).toFixed(2)} to use this code.` };
  }
  const off = c.kind === "percent" ? Math.round((base * c.value) / 100) : Math.min(c.value, base);
  return { ok: true, discount: money(off), label: c.kind === "percent" ? `${c.value}% off` : `₹${(c.value / 100).toFixed(2)} off` };
}

export function ratingSummary(reviews: Review[]): RatingSummary {
  const shown = reviews.filter((r) => !r.hidden && !r.imported);
  const bars: RatingSummary["bars"] = [0, 0, 0, 0, 0];
  shown.forEach((r) => bars[r.rating - 1]++);
  const count = shown.length;
  const average = count ? shown.reduce((t, r) => t + r.rating, 0) / count : 0;
  return { average, count, bars };
}

/** "Priya Sharma" → "Priya S." */
export function publicName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || "Buyer";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** GST shown on the checkout tax line: included in Indian prices, nil on exports. */
export function includedGst(totalInr: number, countryCode: string, rate = 18): number {
  if (countryCode !== "IN") return 0;
  return totalInr - Math.round(totalInr / (1 + rate / 100));
}

export interface CheckoutLines {
  items: { title: string; kind: OrderItem["kind"]; amount: Money }[];
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
}

/** Order lines in the buyer's currency, for checkout, receipts and the order page. */
export function checkoutLines(order: { items: OrderItem[]; discount?: Money; buyerTotal: Money; total: Money; countryCode: string }): CheckoutLines {
  const cur = order.buyerTotal.currency;
  const rate = order.total.amount ? order.buyerTotal.amount / order.total.amount : 1;
  const items = order.items.map((i) => ({ title: i.title, kind: i.kind, amount: money(Math.round(i.price.amount * rate), cur) }));
  const subtotal = money(items.reduce((t, i) => t + i.amount.amount, 0), cur);
  const discount = money(subtotal.amount - order.buyerTotal.amount, cur);
  const tax = money(Math.round(includedGst(order.total.amount, order.countryCode) * rate), cur);
  return { items, subtotal, discount, tax, total: order.buyerTotal };
}
