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
 * Prices are shown in the store's own currency. No exchange-rate source is connected, so nothing
 * is converted or estimated: the price comes back as it is. (The second argument is kept so
 * call sites don't change when a real rate source is added.)
 */
export function localPrice(m: Money, _to?: CurrencyCode): Money {
  return m;
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
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
