/**
 * Domain types shared by the mock layer and (later) the real backend.
 * Money is always integer minor units plus an ISO currency code.
 */

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD" | "AUD" | "CAD";

export interface Money {
  /** Integer minor units (paise, cents). */
  amount: number;
  currency: CurrencyCode;
}

export type ISODate = string;
