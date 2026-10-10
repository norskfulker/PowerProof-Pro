import { evaluateDeals, type CartLine } from "../pricing/deals";
import { quoteShipping, shippingTax, ShippingError, type ShippingSettings } from "../shipping";
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
  /** Absent means digital */
  fulfilment?: string;
  track_stock?: boolean;
  stock?: number | null;
  variants?: VariantRow[];
}

export interface VariantRow {
  id: string;
  title: string;
  price_minor: number;
  stock: number | null;
}

/** What the buyer asked for: a product (and its variant), and how many */
export interface AskedLine {
  productId: string;
  variantId?: string;
  quantity?: number;
}

/** Most of one thing in one order */
export const MAX_QUANTITY = 99;

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
  quantity: number;
  variant_id: string | null;
  variant_title: string | null;
  fulfilment: "digital" | "physical";
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
  /** Shipping and the cash-on-delivery charge (both inside the total) */
  shipping: number;
  codFee: number;
  /** Something in the order is shipped */
  physical: boolean;
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
  /** What the buyer asked for, in order (one of each). Or `lines`, with variants and quantities. */
  productIds?: string[];
  lines?: AskedLine[];
  rules: DealRule[];
  giftChoices?: Record<string, string>;
  /** The order bump: this product at this special price, never discounted again */
  bump?: { productId: string; price: number };
  coupon?: CouponRow;
  countryCode: string;
  registered: boolean;
  /** Physical products: the store's shipping, and whether the buyer pays on delivery */
  shipping?: ShippingSettings;
  cod?: boolean;
  now?: number;
}): PricedOrder {
  const now = input.now ?? Date.now();
  const byId = new Map(input.products.map((p) => [p.id, p]));
  const cur = input.currency;
  const m = (amount: number): Money => ({ amount, currency: cur });
  const physicalOf = (p: ProductRow | undefined) => p?.fulfilment === "physical";

  // The cart: one line per product and variant; downloads are always one
  const merged = new Map<string, { productId: string; variantId?: string; quantity: number }>();
  const askedLines: AskedLine[] = input.lines ?? (input.productIds ?? []).map((productId) => ({ productId }));
  for (const l of askedLines) {
    const key = `${l.productId}|${l.variantId ?? ""}`;
    const q = Math.max(1, Math.min(MAX_QUANTITY, Math.round(l.quantity ?? 1)));
    const prev = merged.get(key);
    merged.set(key, { productId: l.productId, variantId: l.variantId || undefined, quantity: physicalOf(byId.get(l.productId)) ? Math.min(MAX_QUANTITY, (prev?.quantity ?? 0) + q) : 1 });
  }
  const cart = [...merged.values()];
  if (cart.length === 0) throw new CheckoutError("Your cart is empty.");
  if (cart.length > 20) throw new CheckoutError("That's a lot for one order. Split it into two.");
  for (const l of cart) {
    const p = byId.get(l.productId);
    if (!p) throw new CheckoutError("One of those products isn't for sale any more.", 409);
    const variants = p.variants ?? [];
    if (physicalOf(p) && variants.length && !variants.some((v) => v.id === l.variantId)) throw new CheckoutError(`Pick an option for ${p.title}.`, 409);
    if ((!physicalOf(p) || !variants.length) && l.variantId) throw new CheckoutError("One of those options isn't for sale any more.", 409);
  }
  // Stock: what's left, across every line of the same variant (or product)
  for (const l of cart) {
    const p = byId.get(l.productId)!;
    if (!physicalOf(p) || !p.track_stock) continue;
    const v = p.variants?.find((x) => x.id === l.variantId);
    const left = v ? v.stock : p.stock;
    if (left === null || left === undefined) continue;
    const name = v ? `${p.title} (${v.title})` : p.title;
    if (left <= 0) throw new CheckoutError(`${name} is sold out.`, 409);
    if (l.quantity > left) throw new CheckoutError(`Only ${left} of ${name} left. Lower the quantity.`, 409);
  }
  const unitOf = (l: { productId: string; variantId?: string }) => {
    const p = byId.get(l.productId)!;
    return p.variants?.find((v) => v.id === l.variantId)?.price_minor ?? p.price_minor;
  };

  // Deals work per product, on one unit; the result is applied to every unit of that product
  const firstLine = new Map<string, (typeof cart)[number]>();
  for (const l of cart) if (!firstLine.has(l.productId)) firstLine.set(l.productId, l);
  const dealLines: CartLine[] = [...firstLine.keys()].map((productId) => ({ productId }));
  if (input.bump && !firstLine.has(input.bump.productId)) dealLines.push({ productId: input.bump.productId, price: m(input.bump.price), locked: true });
  for (const l of dealLines) if (!byId.has(l.productId)) throw new CheckoutError("One of those products isn't for sale any more.", 409);

  const result = evaluateDeals({
    lines: dealLines,
    rules: input.rules,
    products: input.products.map((p) => ({ id: p.id, title: p.title, price: m(firstLine.has(p.id) ? unitOf(firstLine.get(p.id)!) : p.price_minor) })),
    giftChoices: input.giftChoices,
    now,
  });

  const items: PricedItem[] = [];
  const itemFor = (productId: string, quantity: number, unit: number, total: number, gift: boolean, variantId?: string): PricedItem => {
    const p = byId.get(productId)!;
    const v = p.variants?.find((x) => x.id === variantId);
    return {
      product_id: productId,
      title: p.title,
      quantity,
      variant_id: v?.id ?? null,
      variant_title: v?.title ?? null,
      fulfilment: physicalOf(p) ? "physical" : "digital",
      unit_price_minor: unit,
      discount_minor: unit * quantity - total,
      line_total_minor: total,
      tax_rate_bps: p.tax_rate_bps,
      hsn_sac: p.hsn_sac,
      is_gift: gift,
    };
  };
  for (const dl of result.lines) {
    const mine = cart.filter((l) => l.productId === dl.productId);
    if (!mine.length) {
      // Added by the deals: a gift, or the order bump at its price
      items.push(itemFor(dl.productId, 1, dl.basePrice.amount, dl.price.amount, dl.gift));
      continue;
    }
    const off = dl.basePrice.amount - dl.price.amount;
    // A free unit (a gift, or "cheapest free") is one unit; a percentage applies to every unit
    let freeLeft = dl.free ? off : 0;
    const ratio = !dl.free && dl.basePrice.amount > 0 ? dl.price.amount / dl.basePrice.amount : 1;
    for (const l of mine) {
      const unit = unitOf(l);
      let total = Math.round(unit * l.quantity * ratio);
      if (freeLeft > 0) {
        const take = Math.min(freeLeft, unit, total);
        total -= take;
        freeLeft -= take;
      }
      items.push(itemFor(l.productId, l.quantity, unit, total, dl.gift && dl.free && l === mine[0] && l.quantity === 1, l.variantId));
    }
  }

  const subtotal = items.reduce((t, i) => t + i.unit_price_minor * i.quantity, 0);
  const afterDeals = items.reduce((t, i) => t + i.line_total_minor, 0);
  let couponOff = 0;
  let couponId: string | null = null;
  if (input.coupon) {
    const c = couponDiscount(input.coupon, items.filter((i) => !i.is_gift).map((i) => ({ productId: i.product_id, amount: i.line_total_minor })), now);
    couponOff = Math.min(c.discount, afterDeals);
    couponId = c.id;
  }
  const goods = afterDeals - couponOff;
  const share = afterDeals > 0 ? goods / afterDeals : 1;

  const physicalItems = items.filter((i) => i.fulfilment === "physical");
  const physical = physicalItems.length > 0;
  let shipping = 0;
  let codFee = 0;
  if (physical || input.cod) {
    if (!input.shipping) throw new CheckoutError("This store hasn't set up shipping yet.", 409);
    try {
      const q = quoteShipping(input.shipping, {
        country: input.countryCode,
        goods: Math.round(physicalItems.reduce((t, i) => t + i.line_total_minor, 0) * share),
        physical,
        cod: !!input.cod,
        onlyPhysical: physicalItems.length === items.length,
        total: goods,
      });
      shipping = q.shipping;
      codFee = q.codFee;
    } catch (e) {
      if (e instanceof ShippingError) throw new CheckoutError(e.message, 400);
      throw e;
    }
  }
  const total = goods + shipping + codFee;
  return {
    currency: cur,
    items,
    subtotal,
    discount: subtotal - goods,
    tax: includedTax(items, input.countryCode, input.registered, share) + shippingTax(shipping + codFee, physicalItems.map((i) => i.tax_rate_bps ?? 0), input.countryCode, input.registered),
    total,
    couponId,
    dealIds: result.appliedRuleIds,
    shipping,
    codFee,
    physical,
  };
}
