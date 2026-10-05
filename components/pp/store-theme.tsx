import { themeVars } from "@/lib/store-themes";
import type { StoreTheme } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Scopes a store's theme: palette, accent and font pairing override the tokens inside. */
export function StoreThemeScope({ theme, children, className }: { theme: StoreTheme; children: React.ReactNode; className?: string }) {
  return (
    <div style={themeVars(theme) as React.CSSProperties} className={cn("bg-background font-sans text-foreground", className)}>
      {children}
    </div>
  );
}
