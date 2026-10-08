import "server-only";
import { sbAdmin } from "../supabase/admin";
import type { Rates } from "../fx";
import type { CurrencyCode } from "../types";

/**
 * Exchange rates (units per US dollar) for the currencies we price in, kept in the fx_rates table.
 * They are mid-market rates from a public feed: used to show prices in another currency and to
 * work out what a seller is paid in their own currency. Nothing is guessed: with no rate, nothing converts.
 */
export const CURRENCIES: CurrencyCode[] = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];
const FEED = "https://open.er-api.com/v6/latest/USD";
const FRESH_MS = 24 * 3600_000;
const USABLE_MS = 7 * 24 * 3600_000;

export async function readRates(): Promise<{ rates: Rates; updatedAt: string | null }> {
  const { data } = await sbAdmin().from("fx_rates").select("currency, per_usd, updated_at");
  const rates: Rates = {};
  let updatedAt: string | null = null;
  for (const r of data ?? []) {
    rates[r.currency as CurrencyCode] = Number(r.per_usd);
    if (!updatedAt || r.updated_at < updatedAt) updatedAt = r.updated_at;
  }
  return { rates, updatedAt };
}

/** Fetches today's rates and saves them */
export async function refreshRates(): Promise<{ updated: number }> {
  const res = await fetch(FEED, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  const json = (await res.json().catch(() => ({}))) as { result?: string; rates?: Record<string, number> };
  if (!res.ok || json.result !== "success" || !json.rates) throw new Error("The exchange-rate feed didn't answer.");
  const rows = CURRENCIES.filter((c) => Number.isFinite(json.rates![c]) && json.rates![c] > 0).map((c) => ({ currency: c, per_usd: json.rates![c], updated_at: new Date().toISOString() }));
  if (rows.length < CURRENCIES.length) throw new Error("The exchange-rate feed was missing currencies.");
  const { error } = await sbAdmin().from("fx_rates").upsert(rows, { onConflict: "currency" });
  if (error) throw new Error("Rates couldn't be saved.");
  return { updated: rows.length };
}

/** Rates no older than a day; refreshes when stale, and falls back to older ones (up to a week) if the feed is down */
export async function ensureRates(): Promise<Rates> {
  const cur = await readRates();
  const age = cur.updatedAt ? Date.now() - Date.parse(cur.updatedAt) : Infinity;
  if (age < FRESH_MS && Object.keys(cur.rates).length >= CURRENCIES.length) return cur.rates;
  try {
    await refreshRates();
    return (await readRates()).rates;
  } catch (e) {
    if (age < USABLE_MS) return cur.rates;
    throw e;
  }
}
