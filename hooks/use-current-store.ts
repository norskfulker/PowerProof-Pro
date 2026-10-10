"use client";

import { useApi, type ApiState } from "@/hooks/use-api";
import { getStore, onDataChange } from "@/lib/api";
import type { CurrencyCode, Store } from "@/lib/types";

/** One request shared by every component on the screen; any data change starts a fresh one. */
let inflight: Promise<Store> | undefined;
if (typeof window !== "undefined") onDataChange(() => (inflight = undefined));

function currentStore(): Promise<Store> {
  inflight ??= getStore().catch((e) => {
    inflight = undefined;
    throw e;
  });
  return inflight;
}

/**
 * The creator's current store, read from the database (the `stores` row they own), never from
 * browser state. The creator area only renders once a store exists (the onboarding gate), so
 * screens use this and never ask the creator to make one.
 */
export function useCurrentStore(): ApiState<Store> {
  return useApi(currentStore, [], { live: true });
}

/** The store's currency (what prices are set in), INR until the store has loaded. */
export function useStoreCurrency(): CurrencyCode {
  return useCurrentStore().data?.currency ?? "INR";
}
