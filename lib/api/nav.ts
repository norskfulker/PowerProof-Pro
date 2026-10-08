import type { BadgeKey } from "../nav/config";
import * as live from "./live/catalog";
import { activeStoreId } from "./live/session";

export interface NavCounts {
  storeId: string;
  counts: Partial<Record<BadgeKey, number>>;
}

/** Live numbers for the menu. Store-scoped counts follow the active store. */
export function getNavCounts(area: "creator" | "admin"): Promise<NavCounts> {
  // The admin console isn't connected to the database yet, so it has no counts to show
  if (area === "admin") return Promise.resolve({ storeId: "", counts: {} });
  return live.getNavCounts();
}

/** The store the switcher has chosen; store-scoped links use it. */
export const getActiveStoreId = (): Promise<string> => activeStoreId();
