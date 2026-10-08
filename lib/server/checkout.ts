import { evaluateDeals, type CartLine } from "../pricing/deals";
import type { DealRule, Money } from "../types";

/**
 * Prices an order on the server. The browser only says WHICH products (and which code); every
 * rupee is worked out here from the database, with the same deal engine the storefront shows, so a
 * buyer can't pay less by editing a request.
 */
export interface ProductRow {
  id: string;
  title: string;
  price_minor: number;
  hsn_sac: string | null;
  tax_rate_bps: number | null;
}

export interface CouponRow {
  id: string;
  kind: "percent" | "fixed";
  /** Percent as basis points (2000 = 20%), or minor units for fixed */
  value: number;
  min_subtotal_minor: number | null;
  product_id: string | null;
  max_uses: number | null;
  used_count: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean | null;
}

export interface PricedItem {
  product_id: string;
  title: string;
  unit_price_minor: number;
  discount_minor: number;
  line_total_minor: number;
  tax_rate_bps: number | null;
  hsn_sac: string | null;
  is_gift: boolean;
}

export interface PricedOrder {
  currency: Money["currency"];
  items: PricedItem[];
  subtotal: number;
  /** Deals and the coupon together */
  discount: number;
  tax: number;
  total: number;
  couponId: string | null;
  dealIds: string[];
}

export class CheckoutError extends Error {
  constructor(message: string, readonly status = 400, /** "coupon" when the problem is the discount code, so a quote can carry on without it */ readonly scope?: "coupon") {
    super(message);
  }
}

/** The code works: live, in its dates, not used up, and for something in the cart. Otherwise says why not. */
export function couponDiscount(c: CouponRow | undefined, lines: { productId: string; amount: number }[], now = Date.now()): { discount: number; id: string } {
  if (!c || !c.active) throw new CheckoutError("That code doesn't exist. Check the spelling.", 400, "coupon");
  if (c.starts_at && Date.parse(c.starts_at) > now) throw new CheckoutError("That code isn't live yet.", 400, "coupon");
  if (c.ends_at && Date.parse(c.ends_at) < now) throw new CheckoutError("That code has expired.", 400, "coupon");
  if (c.max_uses != null && (c.used_count ?? 0) >= c.max_uses) throw new CheckoutError("That code has been used up.", 400, "coupon");
  const eligible = c.product_id ? lines.filter((l) => l.productId === c.product_id) : lines;
  if (eligible.length === 0) throw new CheckoutError("That code doesn't apply to this product.", 400, "coupon");
  const base = eligible.reduce((t, l) => t + l.amount, 0);
  const subtotal = lines.reduce((t, l) => t + l.amount, 0);
  if (c.min_subtotal_minor && subtotal < c.min_subtotal_minor) throw new CheckoutError("Spend a little more to use this code.", 400, "coupon");
  const off = c.kind === "percent" ? Math.round((base * c.value) / 10000) : Math.min(c.value, base);
  return { discount: Math.max(0, off), id: c.id };
}

/** GST that's already inside the prices: only for a registered seller selling to a buyer in India */
export function includedTax(items: { line_total_minor: number; tax_rate_bps: number | null }[], countryCode: string, registered: boolean, discountShare = 1): number {
  if (!registered || countryCode !== "IN") return 0;
  return items.reduce((t, i) => {
    const rate = (i.tax_rate_bps ?? 0) / 10000;
    const line = Math.round(i.line_total_minor * discountShare);
    return t + (rate > 0 ? line - Math.round(line / (1 + rate)) : 0);
  }, 0);
}

export function priceOrder(input: {
  currency: Money["currency"];
  products: ProductRow[];
  /** What the buyer asked for, in order. A product may appear once. */
  productIds: string[];
  rules: DealRule[];
  giftChoices?: Record<string, string>;
  /** The order bump: this product at this special price, never discounted again */
  bump?: { productId: string; price: number };
  coupon?: CouponRow;
  countryCode: string;
  registered: boolean;
  now?: number;
}): PricedOrder {
  const now = input.now ?? Date.now();
  const byId = new Map(input.products.map((p) => [p.id, p]));
  const asked = [...new Set(input.productIds)];
  if (asked.length === 0) throw new CheckoutError("Your cart is empty.");
  if (asked.length > 20) throw new CheckoutError("That's a lot for one order. Split it into two.");
  const cur = input.currency;
  const m = (amount: number): Money => ({ amount, currency: cur });

  const lines: CartLine[] = asked.map((productId) => ({ productId }));
  if (input.bump && !asked.includes(input.bump.productId)) lines.push({ productId: input.bump.productId, price: m(input.bump.price), locked: true });
  for (const l of lines) if (!byId.has(l.productId)) throw new CheckoutError("One of those products isn't for sale any more.", 409);

  const result = evaluateDeals({
    lines,
    rules: input.rules,
    products: input.products.map((p) => ({ id: p.id, title: p.title, price: m(p.price_minor) })),
    giftChoices: input.giftChoices,
    now,
  });

  const items: PricedItem[] = result.lines.map((l) => {
    const p = byId.get(l.productId)!;
    return { product_id: l.productId, title: l.title, unit_price_minor: l.basePrice.amount, discount_minor: l.basePrice.amount - l.price.amount, line_total_minor: l.price.amount, tax_rate_bps: p.tax_rate_bps, hsn_sac: p.hsn_sac, is_gift: l.gift };
  });

  const subtotal = items.reduce((t, i) => t + i.unit_price_minor, 0);
  const afterDeals = items.reduce((t, i) => t + i.line_total_minor, 0);
  let couponOff = 0;
  let couponId: string | null = null;
  if (input.coupon) {
    const c = couponDiscount(input.coupon, items.filter((i) => !i.is_gift).map((i) => ({ productId: i.product_id, amount: i.line_total_minor })), now);
    couponOff = Math.min(c.discount, afterDeals);
    couponId = c.id;
  }
  const total = afterDeals - couponOff;
  const share = afterDeals > 0 ? total / afterDeals : 1;
  return {
    currency: cur,
    items,
    subtotal,
    discount: subtotal - total,
    tax: includedTax(items, input.countryCode, input.registered, share),
    total,
    couponId,
    dealIds: result.appliedRuleIds,
  };
}
