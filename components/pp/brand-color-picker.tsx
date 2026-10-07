"use client";

import { useId } from "react";
import { PALETTES } from "@/lib/palettes";
import { normalizeHex, readableOn } from "@/lib/color";
import { cn } from "@/lib/utils";

const BRAND = PALETTES.filter((p) => !["Porcelain", "Sage"].includes(p.name));

/** Preset swatches plus a free colour picker. Always emits a #rrggbb value. */
export function BrandColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const id = useId();
  const current = normalizeHex(value) ?? BRAND[0].bg;
  const custom = !BRAND.some((p) => p.bg.toLowerCase() === current.toLowerCase());
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Brand colour</legend>
      <div className="flex flex-wrap items-center gap-2">
        {BRAND.map((p) => (
          <button
            key={p.name}
            type="button"
            aria-label={p.name}
            aria-pressed={current.toLowerCase() === p.bg.toLowerCase()}
            onClick={() => onChange(p.bg)}
            className={cn("size-11 rounded-full border", current.toLowerCase() === p.bg.toLowerCase() && "outline-2 outline-offset-2 outline-primary")}
            style={{ background: p.bg }}
          />
        ))}
        <label
          htmlFor={id}
          className={cn("relative flex h-11 cursor-pointer items-center gap-2 rounded-full border bg-surface pr-4 pl-1 text-sm", custom && "outline-2 outline-offset-2 outline-primary")}
        >
          <span className="size-9 rounded-full border" style={{ background: current, color: readableOn(current) }} aria-hidden />
          <span className="font-mono text-[0.8125rem] uppercase">{custom ? current : "Custom"}</span>
          <input id={id} type="color" value={current} onChange={(e) => { const c = normalizeHex(e.target.value); if (c) onChange(c); }} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="Pick any colour" />
        </label>
      </div>
    </fieldset>
  );
}
