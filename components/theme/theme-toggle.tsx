"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getThemePref, setThemePref } from "@/lib/api";
import { isThemePref, resolveTheme, THEME_EVENT, type ThemeMode, type ThemePref } from "@/lib/theme";

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

export const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Icon button with a three-way menu, for top bars and footers. */
export function ThemeToggle({ className }: { className?: string }) {
  const { pref, mode, setPref } = useTheme();
  const Icon = pref === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label={`Theme: ${THEME_OPTIONS.find((o) => o.value === pref)!.label}. Change theme`}>
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <ThemeRadioItems pref={pref} onChange={setPref} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same three choices, for use inside another menu (the avatar menu). */
export function ThemeRadioItems({ pref, onChange }: { pref?: ThemePref; onChange?: (p: ThemePref) => void }) {
  const t = useTheme();
  const value = pref ?? t.pref;
  return (
    <DropdownMenuRadioGroup value={value} onValueChange={(v) => isThemePref(v) && (onChange ?? t.setPref)(v)}>
      {THEME_OPTIONS.map((o) => (
        <DropdownMenuRadioItem key={o.value} value={o.value} className="pointer-coarse:min-h-11">
          <o.icon className="size-4" aria-hidden /> {o.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
