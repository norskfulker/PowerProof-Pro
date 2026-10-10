import { evaluateDeals } from "../pricing/deals";
import { dealRuleFrom } from "./live/map";
import { sb } from "../supabase/browser";
import type { Money } from "../types";

/**
 * The total a buyer is about to pay, worked out in the browser from what the database lets anyone
 * read (live deal rules) plus validate_coupon, which checks a code on the database and says what it
 * takes off. This is for showing the buyer the number as they type. The price actually charged is
 * set again on the server when the payment is created, so this can't be used to pay less.
 */
export interface Quote {
  currency: Money["currency"];
  subtotal: number;
  /** Deal paths */
  dealSaving: number;
  /** The code's amount (0 when none, or when it doesn't work) */
  codeOff: number;
  total: number;
  coupon?: { ok: boolean; message: string };
}

export interface QuoteInput {
  storeId: string;
  /** The products in the cart, at the prices the buyer sees */
  products: { id: string; title: string; price: Money }[];
}

const REASON = "That code doesn't work for this order. Check the spelling, the dates, or what it applies to.";

export async function getQuote(input: QuoteInput, code: string): Promise<Quote> {
  const client = sb();
  const cur = input.products[0].price.currency;
  const { data: rows } = await client.from("deal_rules").select("*").eq("store_id", input.storeId).eq("active", true);
  const deals = evaluateDeals({
    lines: input.products.map((p) => ({ productId: p.id })),
    rules: (rows ?? []).map(dealRuleFrom),
    products: input.products.map((p) => ({ id: p.id, title: p.title, price: p.price })),
    now: Date.now(),
  });
  const afterDeals = deals.total.amount;
  const base = { currency: cur, subtotal: deals.subtotal.amount, dealSaving: deals.subtotal.amount - afterDeals };
  const typed = code.trim();
  if (!typed) return { ...base, codeOff: 0, total: afterDeals };

  // A code for the whole store checks against the order total; a code for one product, against that product's line
  const attempts: { subtotal: number; product?: string }[] = [{ subtotal: afterDeals }, ...deals.lines.filter((l) => !l.gift).map((l) => ({ subtotal: l.price.amount, product: l.productId }))];
  for (const a of attempts) {
    const r = await client.rpc("validate_coupon", { p_store: input.storeId, p_code: typed, p_subtotal: a.subtotal, p_product: a.product as string });
    const hit = r.data?.[0];
    if (!r.error && hit) {
      const off = Math.min(Number(hit.out_discount_minor), afterDeals);
      return { ...base, codeOff: off, total: afterDeals - off, coupon: { ok: true, message: "Code applied." } };
    }
  }
  return { ...base, codeOff: 0, total: afterDeals, coupon: { ok: false, message: REASON } };
}
