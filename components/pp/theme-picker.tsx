"use client";

import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { HERO_STYLES, PALETTES } from "@/lib/store-themes";
import type { StoreTheme } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Advanced look: palette, accent and hero layout. Brand colour, fonts, corners and colour mode are on the Base design panel. */
export function ThemePicker({ theme, onChange }: { theme: StoreTheme; onChange: (t: StoreTheme) => void }) {
  const palette = PALETTES.find((p) => p.id === theme.palette) ?? PALETTES[0];
  const set = (p: Partial<StoreTheme>) => onChange({ ...theme, ...p });

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="eyebrow mb-2">Palette</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={theme.palette === p.id}
              onClick={() => set({ palette: p.id, accent: undefined })}
              className={cn("flex items-center gap-2 rounded-control border bg-surface p-2 text-left text-sm font-medium", theme.palette === p.id ? "border-primary outline-2 outline-primary" : "hover:border-border-strong")}
            >
              <span className="flex overflow-hidden rounded-[6px] border" aria-hidden>
                <span className="size-6" style={{ background: p.background }} />
                <span className="size-6" style={{ background: p.primary }} />
                <span className="size-6" style={{ background: p.accent }} />
                <span className="size-6" style={{ background: p.dark.background }} title="Dark" />
              </span>
              {p.name}
              {theme.palette === p.id && <Check className="ml-auto size-4 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <input
          id="tp-accent"
          type="color"
          value={theme.accent ?? palette.accent}
          onChange={(e) => set({ accent: e.target.value.toUpperCase() })}
          className="size-11 shrink-0 cursor-pointer rounded-control border border-input bg-surface p-1"
        />
        <Label htmlFor="tp-accent" className="flex flex-col items-start gap-0">
          <span>Accent colour</span>
          <span className="font-mono text-xs text-muted-foreground">{theme.accent ?? `${palette.accent} (palette)`}</span>
        </Label>
        {theme.accent && (
          <button type="button" className="ml-auto min-h-11 text-sm font-medium underline underline-offset-4" onClick={() => set({ accent: undefined })}>Reset</button>
        )}
      </div>

      <fieldset>
        <legend className="eyebrow mb-2">Hero layout</legend>
        <div className="grid grid-cols-3 gap-2">
          {HERO_STYLES.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-pressed={theme.heroStyle === h.id}
              onClick={() => set({ heroStyle: h.id })}
              title={h.description}
              className={cn("flex flex-col items-center gap-2 rounded-control border bg-surface p-2 text-xs font-medium", theme.heroStyle === h.id ? "border-primary outline-2 outline-primary" : "hover:border-border-strong")}
            >
              <span className="flex h-12 w-full gap-1 rounded-[6px] bg-muted p-1.5" aria-hidden>
                {h.id === "left" && (<><span className="flex-1 rounded-[3px] bg-foreground/60" /><span className="flex-1 rounded-[3px] bg-accent" /></>)}
                {h.id === "centered" && <span className="mx-auto w-2/3 rounded-[3px] bg-foreground/60" />}
                {h.id === "full" && <span className="flex-1 rounded-[3px] bg-primary" />}
              </span>
              {h.name}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
