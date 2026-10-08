import type { CurrencyCode } from "./types";

/**
 * Where a creator is based. The country decides the currency the store sells in; prices are set in
 * that currency. Only countries whose currency we can price in are listed.
 */
export interface Country {
  code: string;
  name: string;
  currency: CurrencyCode;
}

export const COUNTRIES: Country[] = [
  { code: "IN", name: "India", currency: "INR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "BE", name: "Belgium", currency: "EUR" },
  { code: "AT", name: "Austria", currency: "EUR" },
  { code: "FI", name: "Finland", currency: "EUR" },
  { code: "GR", name: "Greece", currency: "EUR" },
];

export const DEFAULT_COUNTRY = "IN";

export const countryByCode = (code: string | null | undefined): Country => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
export const currencyFor = (code: string): CurrencyCode => countryByCode(code).currency;

/** The flag for an ISO country code, as the emoji made of its two letters */
export const flagOf = (code: string | null | undefined) => (code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐");
