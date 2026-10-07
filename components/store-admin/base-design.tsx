"use client";

import { Check } from "lucide-react";
import { MediaUploader } from "@/components/media/media-uploader";
import { BrandColorPicker } from "@/components/pp/brand-color-picker";
import { ColorModeToggle, LIGHT_DARK_AUTO } from "@/components/theme/color-mode-toggle";
import { FONT_PAIRS } from "@/lib/store-themes";
import type { Store, StoreDesign, StoreTheme } from "@/lib/types";
import { cn } from "@/lib/utils";

const CORNERS: { value: NonNullable<StoreTheme["corners"]>; label: string; radius: string }[] = [
  { value: "sharp", label: "Sharp", radius: "2px" },
  { value: "soft", label: "Soft", radius: "10px" },
  { value: "round", label: "Round", radius: "999px" },
];

export interface BaseValues {
  design: StoreDesign;
  logo: Store["logo"];
}

/**
 * The base design: one place, applies to the whole store. Brand colour, fonts, buttons and
 * corners, colour mode and logo. Pages built on top of it inherit all of this.
 */
export function BaseDesign({ value, onChange }: { value: BaseValues; onChange: (v: BaseValues) => void }) {
  const { logo } = value;
  const theme = value.design.theme;
  const setTheme = (p: Partial<StoreTheme>) => onChange({ ...value, design: { ...value.design, theme: { ...theme, ...p } } });
  return (
    <div className="flex flex-col gap-6">
      <BrandColorPicker value={theme.brand ?? "#0F3D33"} onChange={(brand) => setTheme({ brand })} />

      <fieldset>
        <legend className="eyebrow mb-2">Fonts</legend>
        <div className="grid grid-cols-1 gap-2">
          {FONT_PAIRS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={theme.fonts === f.id}
              onClick={() => setTheme({ fonts: f.id })}
              className={cn("flex min-h-11 items-center justify-between gap-3 rounded-control border bg-surface px-3 py-2.5 text-left", theme.fonts === f.id ? "border-primary outline-2 outline-primary" : "hover:border-border-strong")}
            >
              <span>
                <span className="block text-xl leading-tight" style={{ fontFamily: f.display, fontWeight: 700 }}>{f.name}</span>
                <span className="block text-xs text-muted-foreground" style={{ fontFamily: f.body }}>{f.pair}</span>
              </span>
              {theme.fonts === f.id && <Check className="size-4 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-2">Buttons and corners</legend>
        <div className="grid grid-cols-3 gap-2">
          {CORNERS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={(theme.corners ?? "soft") === c.value}
              onClick={() => setTheme({ corners: c.value })}
              className={cn("flex min-h-11 flex-col items-center gap-2 rounded-control border bg-surface p-2 text-xs font-medium", (theme.corners ?? "soft") === c.value ? "border-primary outline-2 outline-primary" : "hover:border-border-strong")}
            >
              <span aria-hidden className="h-7 w-full bg-primary" style={{ borderRadius: c.radius }} />
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-2">Colour mode</legend>
        <ColorModeToggle label="Store colour mode" value={theme.mode ?? "auto"} onChange={(mode) => setTheme({ mode })} options={LIGHT_DARK_AUTO} />
        <p className="mt-1.5 text-sm text-muted-foreground">Auto follows each buyer&apos;s device. Buyers can switch with the toggle in your store&apos;s footer.</p>
      </fieldset>

      <div>
        <MediaUploader compact label="Logo (optional)" kinds={["image"]} aspect="1:1" withFocal={false} hint="Square works best. Without one, your store's first letters are used." value={logo ? { ...logo, kind: "image" } : undefined} onChange={(m) => onChange({ ...value, logo: m ? { src: m.src, alt: m.alt } : undefined })} />
      </div>
    </div>
  );
}
