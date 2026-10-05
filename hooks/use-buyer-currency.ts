"use client";

import { useCallback, useSyncExternalStore } from "react";
import { CURRENCIES, detectCurrency } from "@/lib/money";
import type { CurrencyCode } from "@/lib/types";

const KEY = "pp:buyer-currency";
const listeners = new Set<() => void>();

function read(): CurrencyCode {
  try {
    const v = window.localStorage.getItem(KEY) as CurrencyCode | null;
    if (v && v in CURRENCIES) return v;
  } catch {
    /* private mode */
  }
  return detectCurrency();
}

/** The buyer's display currency: guessed from their timezone, overridable, remembered. */
export function useBuyerCurrency(): [CurrencyCode, (c: CurrencyCode) => void] {
  const currency = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "INR" as CurrencyCode
  );
  const set = useCallback((c: CurrencyCode) => {
    try {
      window.localStorage.setItem(KEY, c);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);
  return [currency, set];
}
