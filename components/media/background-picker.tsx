"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Segmented } from "@/components/pp/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useImageAverage } from "@/hooks/use-image-average";
import { tileContrastWarning, tileTextColor } from "@/lib/media/contrast";
import { PALETTES } from "@/lib/store-themes";
import type { AiPurpose, TileBackground } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MediaUploader } from "./media-uploader";

const EXTRA = ["#FFFFFF", "#F5F6F4", "#F6EFDF", "#0C1F1B", "#000000"];
export const THEME_SWATCHES = [...new Set([...PALETTES.flatMap((p) => [p.primary, p.accent, p.primarySoft]), ...EXTRA].map((c) => c.toUpperCase()))];

type Mode = "color" | "image" | "video";

function defaultFor(mode: Mode, current: TileBackground): TileBackground {
  if (mode === "color") return { kind: "color", color: current.kind === "color" ? current.color : "#0F3D33", overlay: 0 };
  if (mode === "image") return { kind: "image", src: "", alt: "", focal: { x: 50, y: 50 }, overlay: current.overlay ?? 0.3 };
  return { kind: "video", src: "", poster: "", focal: { x: 50, y: 50 }, overlay: current.overlay ?? 0.3 };
}

/**
 * Colour or image (or video, for heroes) behind a tile or section (Part 6B). Text contrast is checked
 * as you go, using the picture's real colours; when it's low you get a warning and an overlay slider.
 * `preview` renders the live tile or section next to the picker.
 */
export function BackgroundPicker({
  label,
  value,
  onChange,
  modes = ["color", "image"],
  preview,
  aiPurpose,
  className,
}: {
  label: string;
  value: TileBackground;
  onChange: (bg: TileBackground) => void;
  modes?: Mode[];
  preview?: (bg: TileBackground, textColor: string) => React.ReactNode;
  aiPurpose?: AiPurpose;
  className?: string;
}) {
  const id = useId();
  // Uploads finish later: merge into the value as it is then, so two uploads at once both land
  const latest = useRef(value);
  const emit = useRef(onChange);
  useEffect(() => {
    latest.current = value;
    emit.current = onChange;
  }, [value, onChange]);
  const avg = useImageAverage(value.kind === "image" ? value.src : value.kind === "video" ? value.poster : undefined);
  const warning = (value.kind === "color" || ("src" in value && value.src)) ? tileContrastWarning(value, avg) : undefined;
  const text = tileTextColor(value, avg);
  const overlayPct = Math.round((value.overlay ?? 0) * 100);
  const isHex = value.kind === "color" && /^#[0-9a-f]{6}$/i.test(value.color);

  return (
    // Side-by-side only when the picker itself has room (it sits in narrow panels and sheets too)
    <div className={cn("@container", className)}>
    <fieldset className={cn("grid min-w-0 grid-cols-1 gap-4", preview && "@2xl:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]")}>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex min-w-0 flex-col gap-4">
        {modes.length > 1 && (
          <Segmented
            label={`${label}: type`}
            value={value.kind}
            onChange={(m) => onChange(defaultFor(m, value))}
            options={modes.map((m) => ({ value: m, label: m === "color" ? "Colour" : m === "image" ? "Image" : "Video" }))}
          />
        )}

        {value.kind === "color" && (
          <>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme colours">
              {THEME_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={value.color.toUpperCase() === c}
                  aria-label={c}
                  onClick={() => onChange({ ...value, color: c })}
                  className={cn("size-8 rounded-full border-2 pointer-coarse:size-11", value.color.toUpperCase() === c ? "border-foreground ring-2 ring-primary ring-offset-2" : "border-border")}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-pick`}>Custom</Label>
                <input id={`${id}-pick`} type="color" value={isHex ? value.color : "#0F3D33"} onChange={(e) => onChange({ ...value, color: e.target.value.toUpperCase() })} className="h-11 w-16 cursor-pointer rounded-control border border-input bg-surface p-1" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-hex`}>Hex</Label>
                <Input id={`${id}-hex`} value={value.color} maxLength={7} className="w-28 font-mono" onChange={(e) => onChange({ ...value, color: e.target.value })} aria-invalid={!isHex || undefined} />
              </div>
            </div>
          </>
        )}

        {value.kind === "image" && (
          <MediaUploader label="Image" kinds={["image", "gif"]} aiPurpose={aiPurpose} value={value.src ? { src: value.src, alt: value.alt, focal: value.focal, kind: "image" } : undefined} onChange={(m) => {
            const v = latest.current;
            if (v.kind === "image") emit.current(m ? { ...v, src: m.src, alt: m.alt, focal: m.focal ?? { x: 50, y: 50 } } : { ...v, src: "", alt: "" });
          }} />
        )}

        {value.kind === "video" && (
          <>
            <MediaUploader label="Video (loops, muted)" kinds={["video"]} withPoster={false} value={value.src ? { src: value.src, alt: "", kind: "video" } : undefined} onChange={(m) => {
              const v = latest.current;
              if (v.kind === "video") emit.current({ ...v, src: m?.src ?? "" });
            }} aspect="16:9" />
            <MediaUploader label="Still poster" hint="Shown on phones and with reduced motion" kinds={["image"]} value={value.poster ? { src: value.poster, alt: "", focal: value.focal } : undefined} onChange={(m) => {
              const v = latest.current;
              if (v.kind === "video") emit.current({ ...v, poster: m?.src ?? "", focal: m?.focal ?? v.focal });
            }} aspect="16:9" withAlt={false} />
          </>
        )}

        {(value.kind !== "color" || warning || overlayPct > 0) && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`${id}-overlay`}>Darken (overlay)</Label>
              <span className="font-mono text-xs text-muted-foreground">{overlayPct}%</span>
            </div>
            <input id={`${id}-overlay`} type="range" min={0} max={80} step={5} value={overlayPct} onChange={(e) => onChange({ ...value, overlay: Number(e.target.value) / 100 })} className="h-11 w-full accent-[var(--primary)]" />
          </div>
        )}

        {warning && (
          <div role="status" className="flex flex-col gap-2 rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {warning.message}
            </p>
            {warning.suggestOverlay !== undefined && (
              <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onChange({ ...value, overlay: warning.suggestOverlay })}>
                Add a {Math.round(warning.suggestOverlay * 100)}% overlay
              </Button>
            )}
          </div>
        )}
      </div>
      {preview && (
        <div className="flex min-w-0 flex-col gap-1.5" role="group" aria-label="Live preview">
          <span className="eyebrow">Live preview</span>
          {preview(value, text)}
        </div>
      )}
    </fieldset>
    </div>
  );
}
