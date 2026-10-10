"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ColorModeToggle, LIGHT_DARK } from "@/components/theme/color-mode-toggle";
import { getThemePref, setThemePref } from "@/lib/api";
import { resolveTheme, THEME_EVENT, type ThemeMode, type ThemePref } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(cb: () => void) {
  const m = window.matchMedia(DARK_QUERY);
  m.addEventListener("change", cb);
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    m.removeEventListener("change", cb);
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Applies a choice to <html> right away (the inline script does the same before first paint). */
export function applyTheme(pref: ThemePref) {
  const mode = resolveTheme(pref, window.matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

/** The creator's or visitor's choice, and what it resolves to on this device. */
export function useTheme(): { pref: ThemePref; mode: ThemeMode; setPref: (p: ThemePref) => void } {
  const pref = useSyncExternalStore(subscribe, () => getThemePref(), () => "system" as ThemePref);
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia(DARK_QUERY).matches, () => false);
  return {
    pref,
    mode: resolveTheme(pref, systemDark),
    setPref: (p) => {
      setThemePref(p);
      applyTheme(p);
      window.dispatchEvent(new Event(THEME_EVENT));
    },
  };
}

/** Keeps <html> in step when the device switches between light and dark while "System" is chosen. */
export function ThemeSync() {
  const { pref, mode } = useTheme();
  useEffect(() => {
    if (document.documentElement.dataset.theme !== mode) applyTheme(pref);
  }, [pref, mode]);
  return null;
}

/** The creator's (or visitor's) colour mode: Light or Dark, saved per person and applied before first paint. */
export function ThemeToggle({ className, iconOnly = true }: { className?: string; iconOnly?: boolean }) {
  const { mode, setPref } = useTheme();
  return <ColorModeToggle label="Colour mode" value={mode} onChange={setPref} options={LIGHT_DARK} iconOnly={iconOnly} className={className} />;
}
