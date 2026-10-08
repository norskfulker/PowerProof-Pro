"use client";

import { useTheme } from "@/components/theme/theme-toggle";
import { fontFaceCss } from "@/lib/fonts";
import { resolveStoreMode, themeVars } from "@/lib/store-themes";
import type { StoreTheme } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Scopes a store's theme: palette, accent and font pairing override the tokens inside, in light or
 * dark (Part 7A). Pass `mode` to force one (the editor's Preview as switch, a buyer's choice);
 * otherwise the creator's default applies, and Auto follows the visitor's site theme.
 */
export function StoreThemeScope({ theme, mode, children, className }: { theme: StoreTheme; mode?: "light" | "dark"; children: React.ReactNode; className?: string }) {
  const site = useTheme().mode;
  const resolved = mode ?? resolveStoreMode(theme, site);
  const fontCss = fontFaceCss(theme.customFont);
  return (
    <div data-theme={resolved} style={themeVars(theme, resolved) as React.CSSProperties} className={cn("bg-background font-sans text-foreground", className)}>
      {fontCss && <style>{fontCss}</style>}
      {children}
    </div>
  );
}
