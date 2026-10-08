import type { CurrencyCode, Money } from "./types";

/**
 * Showing a price in another currency. Rates are units of a currency per 1 US dollar (the fx_rates
 * table). With no rate for either side the price comes back unchanged: nothing is guessed.
 * Display only: buyers are charged in the store's own currency.
 */
export type Rates = Partial<Record<CurrencyCode, number>>;

export function convert(m: Money, to: CurrencyCode, rates: Rates): Money {
  if (m.currency === to) return m;
  const from = rates[m.currency];
  const target = rates[to];
  if (!from || !target) return m;
  // minor units stay hundredths in every supported currency
  return { amount: Math.round((m.amount / from) * target), currency: to };
}

/** The rates the storefront on screen was loaded with; set by its provider so every price shown goes through the same table. */
let active: Rates = {};
export const setActiveRates = (r: Rates) => {
  active = r;
};
export const activeRates = (): Rates => active;

/** Whether there are rates to convert between at least two currencies */
export const canConvert = (r: Rates, base: CurrencyCode) => !!r[base] && Object.keys(r).length > 1;
