"use client";

import { useApi } from "@/hooks/use-api";
import { getSetupMode, getStore, setSetupMode } from "@/lib/api";

export type SetupWay = "ai" | "manual";

/**
 * The store's way of building: with AI or by hand. Until the store first opens, `remember` saves a
 * new pick as the store's way (owners only); after that the database keeps the first one, and it is
 * only the default that screens start from.
 */
export function useSetupMode() {
  const { data } = useApi(async () => {
    const store = await getStore();
    const setup = await getSetupMode(store.id).catch(() => ({ mode: "manual" as SetupWay, locked: store.onboarded }));
    return { storeId: store.id, mode: setup.mode, open: setup.locked || store.onboarded, owner: store.access?.role === "owner" };
  }, []);
  async function remember(way: SetupWay) {
    if (!data || data.open || !data.owner || way === data.mode) return;
    await setSetupMode(way, data.storeId).catch(() => undefined);
  }
  return { mode: data?.mode, open: data?.open ?? false, ready: !!data, remember };
}
