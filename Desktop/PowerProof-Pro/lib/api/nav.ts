import type { BadgeKey } from "../nav/config";
import { getAdminCounts } from "./admin";
import * as live from "./live/catalog";
import { activeStoreId } from "./live/session";

export interface NavCounts {
  storeId: string;
  counts: Partial<Record<BadgeKey, number>>;
}

/** Live numbers for the menu. Store-scoped counts follow the active store. */
export function getNavCounts(area: "creator" | "admin"): Promise<NavCounts> {
  if (area === "admin") return getAdminCounts().then((c) => ({ storeId: "", counts: c }));
  return live.getNavCounts();
}

/** The store the switcher has chosen; store-scoped links use it. */
export const getActiveStoreId = (): Promise<string> => activeStoreId();
