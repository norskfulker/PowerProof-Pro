import { currencyFor } from "./countries";
import type { Rates } from "./fx";
import { formatMoney } from "./money";
import type { CurrencyCode } from "./types";

/**
 * Decides how a withdrawal is paid out. The money the seller earned sits in the store's currency.
 * It is paid in the currency of the seller's own country: an Indian bank account or UPI id is
 * always rupees, so a seller earning in dollars with an Indian account is paid the rupee equivalent.
 * Razorpay's payout API sends rupees to Indian accounts; every other route (another country,
 * crypto, an account saved before automatic payouts) stays in the hand-sent queue, with the
 * amount already worked out in the right currency.
 */
export interface PlanInput {
  /** The currency the balance is held in (the store's) */
  balanceCurrency: CurrencyCode;
  amountMinor: number;
  /** The seller's country (ISO code) */
  sellerCountry: string | null;
  methodKind: "bank" | "upi" | "crypto" | null;
  /** The account is registered with Razorpay, so it can be paid automatically */
  hasFundAccount: boolean;
  rates: Rates;
}

export type PayoutPlan =
  | { route: "razorpayx"; currency: "INR"; amountMinor: number; rate: number; mode: "IMPS" | "NEFT" | "UPI" }
  | { route: "manual"; currency: CurrencyCode; amountMinor: number; rate: number | null; reason: string };

/** Razorpay's IMPS limit is ₹5,00,000; above it the transfer goes by NEFT */
const IMPS_LIMIT_PAISE = 50_000_000;
const MIN_PAISE = 100;

export function planPayout(p: PlanInput): PayoutPlan {
  const indianRail = p.methodKind === "bank" || p.methodKind === "upi";
  const dest: CurrencyCode = indianRail ? "INR" : currencyFor(p.sellerCountry ?? "IN");

  let rate: number | null = null;
  let amount = p.amountMinor;
  if (dest !== p.balanceCurrency) {
    const from = p.rates[p.balanceCurrency];
    const to = p.rates[dest];
    if (from && to) {
      rate = to / from;
      amount = Math.round((p.amountMinor / from) * to);
    } else {
      return { route: "manual", currency: p.balanceCurrency, amountMinor: p.amountMinor, rate: null, reason: `No exchange rate between ${p.balanceCurrency} and ${dest} yet. Refresh the rates on the Payment gateway page.` };
    }
  } else {
    rate = 1;
  }

  if (p.methodKind === "crypto") return { route: "manual", currency: dest, amountMinor: amount, rate, reason: "Crypto wallets are paid by hand." };
  if (!indianRail) return { route: "manual", currency: dest, amountMinor: amount, rate, reason: `Razorpay's payout API sends rupees to Indian accounts. Send ${formatMoney({ amount, currency: dest })} to this seller's account in ${dest} by hand.` };
  if (!p.hasFundAccount) return { route: "manual", currency: dest, amountMinor: amount, rate, reason: "This account was saved before automatic payouts. Ask the seller to add it again, or pay it by hand." };
  if (amount < MIN_PAISE) return { route: "manual", currency: dest, amountMinor: amount, rate, reason: "Under ₹1 after conversion: too small to send." };
  return { route: "razorpayx", currency: "INR", amountMinor: amount, rate: rate ?? 1, mode: p.methodKind === "upi" ? "UPI" : amount <= IMPS_LIMIT_PAISE ? "IMPS" : "NEFT" };
}
