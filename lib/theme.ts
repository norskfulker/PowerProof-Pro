/** Light, dark or follow the device (Part 7A). */
export type ThemePref = "light" | "dark" | "system";
export type ThemeMode = "light" | "dark";

export const THEME_KEY = "pp:theme";
export const THEME_EVENT = "pp:theme-change";

export function isThemePref(v: unknown): v is ThemePref {
  return v === "light" || v === "dark" || v === "system";
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): ThemeMode {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

/**
 * Runs in <head> before the first paint so the page never flashes the wrong theme. Kept tiny and
 * dependency-free; it mirrors resolveTheme. Pages that must stay light (emails, invoices) set
 * data-theme="light" on their own wrapper.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light"}catch(e){}})();`;
