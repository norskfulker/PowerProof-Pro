import { activeRates, convert } from "./fx";
import type { CurrencyCode, Money } from "./types";

/** Pricing constants shown across the product. Founder can change these in one place. */
export const PRICING = {
  monthlyUsd: 2000, // $20.00 in cents
  freeMonths: 1,
  platformFeePct: 3,
  gatewayFeePct: 2,
} as const;

export const CURRENCIES: Record<CurrencyCode, { symbol: string; locale: string; name: string }> = {
  INR: { symbol: "₹", locale: "en-IN", name: "Indian rupee" },
  USD: { symbol: "$", locale: "en-US", name: "US dollar" },
  EUR: { symbol: "€", locale: "de-DE", name: "euro" },
  GBP: { symbol: "£", locale: "en-GB", name: "British pound" },
  AED: { symbol: "AED", locale: "en-AE", name: "UAE dirham" },
  SGD: { symbol: "S$", locale: "en-SG", name: "Singapore dollar" },
  AUD: { symbol: "A$", locale: "en-AU", name: "Australian dollar" },
  CAD: { symbol: "C$", locale: "en-CA", name: "Canadian dollar" },
};

export function money(amount: number, currency: CurrencyCode = "INR"): Money {
  return { amount: Math.round(amount), currency };
}

/** Build Money from a major-unit number, e.g. 499 → ₹499.00 */
export function fromMajor(major: number, currency: CurrencyCode = "INR"): Money {
  return money(Math.round(major * 100), currency);
}

export function toMajor(m: Money): number {
  return m.amount / 100;
}

export function formatMoney(
  m: Money,
  opts: { compact?: boolean; signed?: boolean } = {}
): string {
  const meta = CURRENCIES[m.currency];
  const major = m.amount / 100;
  const abs = Math.abs(major);
  let body: string;
  if (opts.compact && abs >= 100000 && m.currency === "INR") {
    body = `${(abs / 100000).toFixed(2)}L`;
  } else if (opts.compact && abs >= 1000 && m.currency !== "INR") {
    body = `${(abs / 1000).toFixed(2)}k`;
  } else {
    body = new Intl.NumberFormat(meta.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
  }
  const sep = meta.symbol.length > 1 && /[A-Z]$/.test(meta.symbol) ? " " : "";
  const sign = major < 0 ? "−" : opts.signed && major > 0 ? "+" : "";
  return `${sign}${meta.symbol}${sep}${body}`;
}

export function add(a: Money, b: Money): Money {
  return money(a.amount + b.amount, a.currency);
}

export function sub(a: Money, b: Money): Money {
  return money(a.amount - b.amount, a.currency);
}

export function sum(items: Money[], currency: CurrencyCode = "INR"): Money {
  return money(
    items.reduce((t, m) => t + m.amount, 0),
    currency
  );
}

/**
 * A price as the buyer chose to see it. With rates for both currencies it is converted (display
 * only: checkout charges the store's own currency); without them the price comes back as it is.
 */
export function localPrice(m: Money, to?: CurrencyCode): Money {
  return to ? convert(m, to, activeRates()) : m;
}

export interface FeeBreakdown {
  sale: Money;
  gateway: Money;
  platform: Money;
  keep: Money;
  keepPct: number;
}

export function feeBreakdown(
  sale: Money,
  platformPct: number = PRICING.platformFeePct,
  gatewayPct: number = PRICING.gatewayFeePct
): FeeBreakdown {
  const gateway = money(Math.round((sale.amount * gatewayPct) / 100), sale.currency);
  const platform = money(Math.round((sale.amount * platformPct) / 100), sale.currency);
  const keep = money(sale.amount - gateway.amount - platform.amount, sale.currency);
  return {
    sale,
    gateway,
    platform,
    keep,
    keepPct: sale.amount ? (keep.amount / sale.amount) * 100 : 0,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** Percent off, from the price and the crossed-out original (0 when there's no discount). */
export function discountPercent(price: Money, compareAt?: Money): number {
  if (!compareAt || compareAt.amount <= price.amount || compareAt.amount <= 0) return 0;
  return Math.round((1 - price.amount / compareAt.amount) * 100);
}

/** The original price that makes `price` look `percent` off, rounded to a whole currency unit. */
export function compareAtFromPercent(price: Money, percent: number): Money {
  const p = Math.min(90, Math.max(1, Math.round(percent)));
  const original = price.amount / (1 - p / 100);
  return money(Math.max(price.amount + 100, Math.round(original / 100) * 100), price.currency);
}
