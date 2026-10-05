"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CANVAS_SIZES, drawCover } from "@/lib/cover-draw";
import { slugify } from "@/lib/slug";
import type { CoverSpec, CoverTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CoverArt } from "./product-cover";

const TEMPLATES: { id: CoverTemplate; name: string }[] = [
  { id: "block", name: "Block" },
  { id: "split", name: "Split" },
  { id: "frame", name: "Frame" },
  { id: "stack", name: "Stack" },
  { id: "badge", name: "Badge" },
  { id: "grid", name: "Grid" },
];

/** Creator-facing palettes. These are design data the creator exports, not UI colours. */
export const PALETTES: { name: string; bg: string; fg: string; accent: string }[] = [
  { name: "Emerald", bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" },
  { name: "Brass", bg: "#C9A24F", fg: "#0C1F1B", accent: "#0F3D33" },
  { name: "Ink", bg: "#0C1F1B", fg: "#F5F6F4", accent: "#C9A24F" },
  { name: "Porcelain", bg: "#F5F6F4", fg: "#0C1F1B", accent: "#0F3D33" },
  { name: "Monsoon", bg: "#1D5C7A", fg: "#F5F6F4", accent: "#C9A24F" },
  { name: "Haldi", bg: "#B7791F", fg: "#F5F6F4", accent: "#0C1F1B" },
  { name: "Sage", bg: "#E3ECE8", fg: "#0F3D33", accent: "#0F3D33" },
  { name: "Leaf", bg: "#1F7A4D", fg: "#F5F6F4", accent: "#C9A24F" },
];

export const DEFAULT_SPEC: CoverSpec = {
  template: "split",
  title: "Your product name",
  subtitle: "Notion kit",
  ...PALETTES[0],
};

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="size-11 shrink-0 cursor-pointer rounded-control border border-input bg-surface p-1"
      />
      <Label htmlFor={id} className="flex flex-col items-start gap-0">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </Label>
    </div>
  );
}

export function ImageMaker({
  initial = DEFAULT_SPEC,
  onUse,
  className,
}: {
  initial?: CoverSpec;
  /** When given, shows "Use as product image". */
  onUse?: (spec: CoverSpec, dataUrl: string) => void;
  className?: string;
}) {
  const [spec, setSpec] = useState<CoverSpec>(initial);
  const [sizeId, setSizeId] = useState("cover");
  const canvas = useRef<HTMLCanvasElement>(null);
  const size = CANVAS_SIZES.find((s) => s.id === sizeId)!;
  const set = (p: Partial<CoverSpec>) => setSpec((s) => ({ ...s, ...p }));

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    // Fonts may still be loading on first paint
    document.fonts?.ready.then(() => drawCover(ctx, spec, size.w, size.h));
    drawCover(ctx, spec, size.w, size.h);
  }, [spec, size]);

  const exportPng = () => {
    const url = canvas.current?.toDataURL("image/png");
    if (!url) return toast.error("Export failed. Try a smaller size.");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(spec.title) || "cover"}-${size.w}x${size.h}.png`;
    a.click();
    toast.success("PNG saved", { description: `${size.w} × ${size.h}px` });
  };

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]", className)}>
      <div className="flex flex-col gap-3">
        <div className="grid place-items-center rounded-card border bg-surface-sunken p-4 md:p-8">
          <canvas
            ref={canvas}
            width={size.w}
            height={size.h}
            role="img"
            aria-label={`Preview: ${spec.title}`}
            className="h-auto max-h-[62vh] w-auto max-w-full rounded-media border bg-surface"
          />
        </div>
        <p className="text-center font-mono text-xs text-muted-foreground">
          {size.w} × {size.h}px · exports as PNG
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="eyebrow mb-2">Template</legend>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => set({ template: t.id })}
                aria-pressed={spec.template === t.id}
                className={cn(
                  "flex flex-col gap-1.5 rounded-control border bg-surface p-1.5 text-xs font-medium transition-[border-color]",
                  spec.template === t.id ? "border-primary outline-2 outline-primary" : "hover:border-border-strong"
                )}
              >
                <CoverArt cover={{ ...spec, template: t.id, title: "Aa", subtitle: undefined }} size="sm" className="rounded-[6px]" />
                {t.name}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="im-title">Title</Label>
            <Input id="im-title" value={spec.title} maxLength={70} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="im-sub">Small label</Label>
            <Input id="im-sub" value={spec.subtitle ?? ""} maxLength={30} onChange={(e) => set({ subtitle: e.target.value })} placeholder="Ebook · 84 pages" />
          </div>
        </div>

        <fieldset>
          <legend className="eyebrow mb-2">Colours</legend>
          <div className="mb-3 flex flex-wrap gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.name}
                type="button"
                title={p.name}
                aria-label={`${p.name} palette`}
                onClick={() => set({ bg: p.bg, fg: p.fg, accent: p.accent })}
                className={cn(
                  "relative size-11 overflow-hidden rounded-full border",
                  spec.bg === p.bg && spec.fg === p.fg && "outline-2 outline-offset-2 outline-primary"
                )}
                style={{ background: p.bg }}
              >
                <span className="absolute right-1.5 bottom-1.5 size-3 rounded-full" style={{ background: p.accent }} />
              </button>
            ))}
          </div>
          <div className="grid gap-3">
            <ColorField id="im-bg" label="Background" value={spec.bg} onChange={(bg) => set({ bg })} />
            <ColorField id="im-fg" label="Text" value={spec.fg} onChange={(fg) => set({ fg })} />
            <ColorField id="im-ac" label="Accent" value={spec.accent} onChange={(accent) => set({ accent })} />
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="im-size">Size</Label>
          <Select value={sizeId} onValueChange={setSizeId}>
            <SelectTrigger id="im-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANVAS_SIZES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          {onUse && (
            <Button onClick={() => onUse(spec, canvas.current?.toDataURL("image/png") ?? "")}>
              <ImagePlus aria-hidden /> Use as product image
            </Button>
          )}
          <Button variant={onUse ? "secondary" : "primary"} onClick={exportPng}>
            <Download aria-hidden /> Export PNG
          </Button>
        </div>
      </div>
    </div>
  );
}
