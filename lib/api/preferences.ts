import { isThemePref, THEME_KEY, type ThemePref } from "../theme";

/**
 * Display preferences. The theme lives in this browser for now; when accounts are backed by the
 * server, these two functions sync it to the account and nothing else changes.
 */
export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return isThemePref(v) ? v : "system";
  } catch {
    return "system";
  }
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
}

const storeKey = (storeId: string) => `pp:store-theme:${storeId}`;

/** A buyer's own light/dark choice for one store, overriding the creator's default. */
export function getBuyerStoreTheme(storeId: string): "light" | "dark" | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = window.localStorage.getItem(storeKey(storeId));
    return v === "light" || v === "dark" ? v : undefined;
  } catch {
    return undefined;
  }
}

export function setBuyerStoreTheme(storeId: string, mode: "light" | "dark" | undefined): void {
  try {
    if (mode) window.localStorage.setItem(storeKey(storeId), mode);
    else window.localStorage.removeItem(storeKey(storeId));
  } catch {
    /* storage blocked */
  }
}
