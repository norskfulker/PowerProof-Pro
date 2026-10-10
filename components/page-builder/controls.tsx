"use client";

import { useId, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ICON_GROUPS, StoreIcon, type IconWeight } from "@/components/pp/icon-library";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/pp/segmented";
import type { RenderContext } from "@/lib/api";
import { normalizeHex } from "@/lib/color";
import { PALETTES, schemesOf } from "@/lib/store-themes";
import type { StoreTheme } from "@/lib/types";
import { MediaUploader as SharedUploader } from "@/components/media/media-uploader";
import type { MediaKind } from "@/lib/media/store";
import type { Background, BlockStyle } from "@/lib/pages/schema";
import { cn } from "@/lib/utils";
import { contrastWarning } from "./renderer";

/* ------------------------------------------------------------------ */
/* Small labelled fields                                                */
/* ------------------------------------------------------------------ */

export function TextField({ label, value, onChange, multiline, max, hint, placeholder, error }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; max?: number; hint?: string; placeholder?: string; error?: string }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea id={id} value={value} rows={5} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} aria-invalid={!!error || undefined} />
      ) : (
        <Input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} aria-invalid={!!error || undefined} />
      )}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-err`} className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SwitchField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-start justify-between gap-4">
      <label htmlFor={id} className="flex cursor-pointer flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ChoiceField<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium" aria-hidden>
        {label}
      </span>
      <Segmented label={label} value={value} onChange={onChange} options={options} className="self-start" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Colours: store palette swatches, a short list, and a free picker      */
/* ------------------------------------------------------------------ */

const EXTRA = ["#FFFFFF", "#F5F6F4", "#F6EFDF", "#0C1F1B", "#000000"];

export function ColorField({ label, value, onChange, swatches: own }: { label: string; value: string; onChange: (v: string) => void; /** Colours offered first; the palette list when left out */ swatches?: string[] }) {
  const pickerId = useId();
  const swatches = [...new Set((own ?? [...PALETTES.flatMap((p) => [p.primary, p.accent, p.primarySoft]), ...EXTRA]).map((c) => c.toUpperCase()))];
  const current = normalizeHex(value) ?? "#000000";
  const custom = !swatches.includes(current);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value.toUpperCase() === c}
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn("size-8 rounded-full border-2 pointer-coarse:size-11", value.toUpperCase() === c ? "border-foreground ring-2 ring-primary ring-offset-2" : "border-border")}
            style={{ background: c }}
          />
        ))}
        <label htmlFor={pickerId} className={cn("relative flex h-8 cursor-pointer items-center gap-1.5 rounded-full border bg-surface pr-3 pl-1 text-xs pointer-coarse:h-11", custom && "ring-2 ring-primary ring-offset-2")}>
          <span className="size-6 rounded-full border" style={{ background: current }} aria-hidden />
          <span className="font-mono uppercase">{custom ? current : "Custom"}</span>
          <input id={pickerId} type="color" value={current} onChange={(e) => { const c = normalizeHex(e.target.value); if (c) onChange(c); }} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`${label}: pick any colour`} />
        </label>
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Media                                                                */
/* ------------------------------------------------------------------ */

/**
 * The shared uploader (Part 6A: progress, library, AI, limits) adapted to the page builder's plain
 * `src` strings. A product's cover can also be used ("product:<id>").
 */
export function MediaUploader({ label, value, onChange, kinds, context }: { label: string; value: string; onChange: (src: string) => void; kinds: MediaKind[]; context: RenderContext }) {
  const usingCover = value.startsWith("product:");
  const kind: MediaKind = kinds.includes("video") && !kinds.includes("image") ? "video" : kinds.includes("gif") && !kinds.includes("image") ? "gif" : "image";
  return (
    <div className="flex flex-col gap-3 rounded-control border p-3">
      <SharedUploader
        compact
        label={label}
        kinds={kinds}
        withAlt={false}
        withFocal={false}
        withPoster={false}
        aiPurpose={kinds.includes("image") ? "hero_banner" : undefined}
        value={value && !usingCover ? { src: value, alt: "", kind } : undefined}
        onChange={(m) => onChange(m?.src ?? "")}
      />
      {kinds.includes("image") && context.products.length > 0 && (
        <SelectField
          label="Or use a product cover"
          value={usingCover ? value : "none"}
          onChange={(v) => onChange(v === "none" ? "" : v)}
          options={[{ value: "none", label: usingCover ? "Stop using the cover" : "Pick a product" }, ...context.products.map((p) => ({ value: `product:${p.id}`, label: p.title }))]}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Background                                                           */
/* ------------------------------------------------------------------ */

const BG_KINDS: { value: Background["kind"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "solid", label: "Colour" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Image" },
  { value: "gif", label: "GIF" },
  { value: "video", label: "Video" },
];

function defaultBg(kind: Background["kind"], current: Background): Background {
  const color = current.kind === "solid" ? current.color : current.kind === "gradient" ? current.from : "#0F3D33";
  switch (kind) {
    case "none":
      return { kind };
    case "solid":
      return { kind, color };
    case "gradient":
      return { kind, from: color, to: "#0C1F1B", angle: 135 };
    case "image":
    case "gif":
      return { kind, src: "", alt: "", focal: { x: 50, y: 50 } };
    case "video":
      return { kind, src: "", poster: "", focal: { x: 50, y: 50 } };
  }
}

/** Background, overlay, focal point and text colour, with a live contrast warning. */
export function BackgroundPicker({ style, onChange, context }: { style: BlockStyle; onChange: (patch: Partial<BlockStyle>, coalesceKey?: string) => void; context: RenderContext }) {
  const bg = style.background;
  const warning = contrastWarning(style);
  const media = bg.kind === "image" || bg.kind === "gif" || bg.kind === "video";
  return (
    <div className="flex flex-col gap-4">
      <SelectField label="Background" value={bg.kind} onChange={(k) => onChange({ background: defaultBg(k, bg), overlay: k === "image" || k === "gif" || k === "video" ? Math.max(style.overlay, 0.4) : style.overlay, tone: k === "none" ? "auto" : style.tone })} options={BG_KINDS} />
      {bg.kind === "solid" && <ColorField label="Colour" value={bg.color} onChange={(color) => onChange({ background: { ...bg, color } })} />}
      {bg.kind === "gradient" && (
        <>
          <ColorField label="From" value={bg.from} onChange={(from) => onChange({ background: { ...bg, from } })} />
          <ColorField label="To" value={bg.to} onChange={(to) => onChange({ background: { ...bg, to } })} />
          <RangeField label="Angle" value={bg.angle} min={0} max={360} step={15} suffix="°" onChange={(angle) => onChange({ background: { ...bg, angle } }, "angle")} />
        </>
      )}
      {(bg.kind === "image" || bg.kind === "gif") && (
        <>
          <MediaUploader label={bg.kind === "gif" ? "GIF" : "Image"} value={bg.src} kinds={bg.kind === "gif" ? ["gif"] : ["image"]} context={context} onChange={(src) => onChange({ background: { ...bg, src } })} />
          <TextField label="Describe it (for screen readers)" value={bg.alt} max={200} onChange={(alt) => onChange({ background: { ...bg, alt } }, "alt")} hint="Leave empty if it's only decoration." />
        </>
      )}
      {bg.kind === "video" && (
        <>
          <MediaUploader label="Video (loops, muted)" value={bg.src} kinds={["video"]} context={context} onChange={(src) => onChange({ background: { ...bg, src } })} />
          <MediaUploader label="Poster image" value={bg.poster} kinds={["image"]} context={context} onChange={(poster) => onChange({ background: { ...bg, poster } })} />
          <p className="text-xs text-muted-foreground">Phones and anyone who prefers less motion see the poster instead of the video.</p>
        </>
      )}
      {media && (
        <>
          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="mb-1 text-sm font-medium">Focal point</legend>
            <RangeField label="Across" value={bg.focal.x} min={0} max={100} step={5} suffix="%" onChange={(x) => onChange({ background: { ...bg, focal: { ...bg.focal, x } } }, "fx")} />
            <RangeField label="Down" value={bg.focal.y} min={0} max={100} step={5} suffix="%" onChange={(y) => onChange({ background: { ...bg, focal: { ...bg.focal, y } } }, "fy")} />
          </fieldset>
          <ColorField label="Overlay colour" value={style.overlayColor} onChange={(overlayColor) => onChange({ overlayColor })} />
          <RangeField label="Overlay" value={Math.round(style.overlay * 100)} min={0} max={80} step={5} suffix="%" onChange={(v) => onChange({ overlay: v / 100 }, "overlay")} />
        </>
      )}
      {bg.kind !== "none" && (
        <ChoiceField
          label="Text colour"
          value={style.tone}
          onChange={(tone) => onChange({ tone })}
          options={[
            { value: "auto", label: "Auto" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      )}
      {warning && (
        <p role="status" className="flex items-start gap-2 rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          {warning}
        </p>
      )}
    </div>
  );
}

export function RangeField({ label, value, onChange, min, max, step, suffix = "" }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-[var(--primary)]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                                */
/* ------------------------------------------------------------------ */

/** Edit cells in a grid. Add and remove rows and columns; first row can be the header. */
export function TableEditor({ rows, onChange }: { rows: string[][]; onChange: (rows: string[][], coalesceKey?: string) => void }) {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const norm = rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""));
  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-80 overflow-auto rounded-control border">
        <table className="w-full text-sm">
          <tbody>
            {norm.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0">
                {r.map((c, j) => (
                  <td key={j} className="p-1">
                    <Input aria-label={`Row ${i + 1}, column ${j + 1}`} value={c} className="h-11 min-w-24" onChange={(e) => onChange(norm.map((rr, ii) => (ii === i ? rr.map((cc, jj) => (jj === j ? e.target.value : cc)) : rr)), `cell-${i}-${j}`)} />
                  </td>
                ))}
                <td className="w-12 p-1">
                  <Button type="button" variant="ghost" size="icon" disabled={norm.length <= 1} onClick={() => onChange(norm.filter((_, ii) => ii !== i))} aria-label={`Delete row ${i + 1}`}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={norm.length >= 30} onClick={() => onChange([...norm, Array(cols).fill("")])}>
          <Plus aria-hidden /> Row
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={cols >= 8} onClick={() => onChange(norm.map((r) => [...r, ""]))}>
          <Plus aria-hidden /> Column
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={cols <= 1} onClick={() => onChange(norm.map((r) => r.slice(0, -1)))}>
          <Trash2 aria-hidden /> Last column
        </Button>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Links: the store's own places, a section on this page, or any https  */
/* ------------------------------------------------------------------ */

const CUSTOM = "__custom";
const NOWHERE = "__none";

/** Where a link can go, as page-builder hrefs */
export function linkOptions(context: RenderContext, sections: { id: string; label: string }[] = []): { group: string; items: { value: string; label: string }[] }[] {
  const base = `/s/${context.store.slug}`;
  return [
    { group: "Store", items: [{ value: base, label: "Home" }, { value: `${base}/products`, label: "All products" }, { value: `${base}/about`, label: "About" }, { value: `${base}/faq`, label: "FAQ" }, { value: `${base}/contact`, label: "Contact" }] },
    { group: "Collections", items: context.collections.map((c) => ({ value: `${base}/c/${c.slug}`, label: c.name })) },
    { group: "Products", items: context.products.map((p) => ({ value: `${base}/${p.slug}`, label: p.title })) },
    { group: "On this page", items: sections.map((s) => ({ value: `#section-${s.id}`, label: s.label })) },
  ].filter((g) => g.items.length);
}

/**
 * "Goes to": a store page, a collection, a product, a section on this page, or any address.
 * The value is a plain href (a store path, #section-…, https:// or mailto:).
 */
export function LinkField({ label, value, onChange, context, sections, allowNone, error }: { label: string; value: string; onChange: (v: string) => void; context: RenderContext; sections?: { id: string; label: string }[]; allowNone?: boolean; error?: string }) {
  const id = useId();
  const groups = linkOptions(context, sections);
  const known = groups.some((g) => g.items.some((i) => i.value === value));
  const choice = value === "" ? (allowNone ? NOWHERE : CUSTOM) : known ? value : CUSTOM;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={choice} onValueChange={(v) => onChange(v === CUSTOM ? (known ? "https://" : value || "https://") : v === NOWHERE ? "" : v)}>
        <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NOWHERE}>Nowhere</SelectItem>}
          {groups.map((g) => (
            <SelectGroup key={g.group}>
              <SelectLabel>{g.group}</SelectLabel>
              {g.items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectGroup>
          ))}
          <SelectItem value={CUSTOM}>Another address…</SelectItem>
        </SelectContent>
      </Select>
      {choice === CUSTOM && <Input aria-label={`${label}: address`} value={value} placeholder="https://" maxLength={500} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} />}
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Colour schemes                                                       */
/* ------------------------------------------------------------------ */

/** Pick one of the theme's colour schemes, shown as little swatches. Empty follows what's around it. */
export function SchemeField({ label = "Colour scheme", value, onChange, theme, mode = "light", noneLabel = "Same as around it" }: { label?: string; value: string; onChange: (v: string) => void; theme: StoreTheme; mode?: "light" | "dark"; noneLabel?: string }) {
  const schemes = schemesOf(theme);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
        <button type="button" role="radio" aria-checked={!value} onClick={() => onChange("")} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-control border border-dashed p-1.5 text-center text-[0.6875rem] leading-tight", !value ? "border-primary ring-2 ring-primary" : "hover:border-border-strong")}>
          {noneLabel}
        </button>
        {schemes.map((sc) => {
          const c = sc[mode];
          return (
            <button key={sc.id} type="button" role="radio" aria-checked={value === sc.id} aria-label={sc.name} onClick={() => onChange(sc.id)} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-control border p-1.5", value === sc.id ? "border-primary ring-2 ring-primary" : "hover:border-border-strong")} style={{ background: c.background, color: c.text }}>
              <span className="font-display text-base leading-none font-bold" aria-hidden>Aa</span>
              <span className="flex items-center gap-1" aria-hidden>
                <span className="h-2 w-5 rounded-full" style={{ background: c.button }} />
              </span>
              <span className="max-w-full truncate text-[0.6875rem]">{sc.name}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                                */
/* ------------------------------------------------------------------ */

const WEIGHT_LABEL: Record<IconWeight, string> = { thin: "Thin", light: "Light", regular: "Regular", bold: "Bold", fill: "Filled", duotone: "Two-tone" };

/** A searchable grid of the icon library. Picking one applies it at once. */
export function IconPicker({ value, onPick, weight = "regular" }: { value: string; onPick: (name: string) => void; weight?: IconWeight }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const groups = ICON_GROUPS.map((g) => ({ ...g, names: g.names.filter((n) => !term || n.toLowerCase().includes(term) || g.label.toLowerCase().includes(term)) })).filter((g) => g.names.length);
  return (
    <div className="flex flex-col gap-3">
      <Input type="search" aria-label="Search icons" placeholder="Search icons: truck, heart, gift…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {groups.length === 0 && <p className="text-sm text-muted-foreground">No icon called “{q}”.</p>}
      {groups.map((g) => (
        <fieldset key={g.label} className="flex flex-col gap-1.5">
          <legend className="eyebrow mb-1">{g.label}</legend>
          <div role="radiogroup" aria-label={g.label} className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
            {g.names.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={n.replace(/([a-z])([A-Z])/g, "$1 $2")}
                title={n.replace(/([a-z])([A-Z])/g, "$1 $2")}
                onClick={() => onPick(n)}
                className={cn("grid aspect-square place-items-center rounded-control border bg-surface hover:border-primary hover:bg-primary-soft", value === n && "border-primary bg-primary-soft text-primary ring-2 ring-primary")}
              >
                <StoreIcon name={n} weight={weight} className="size-5" />
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function IconPickerDialog({ open, value, weight, onPick, onClose }: { open: boolean; value: string; weight?: IconWeight; onPick: (name: string) => void; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Pick an icon</DialogTitle>
          <DialogDescription>It changes on the page straight away.</DialogDescription>
        </DialogHeader>
        <IconPicker value={value} weight={weight} onPick={(n) => { onPick(n); onClose(); }} />
      </DialogContent>
    </Dialog>
  );
}

/** The current icon with a button to change it (and, optionally, to take it away) */
export function IconField({ label = "Icon", value, onChange, weight, allowNone }: { label?: string; value: string; onChange: (name: string) => void; weight?: IconWeight; allowNone?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 flex-1 items-center gap-3 rounded-control border bg-surface px-3 text-left text-sm hover:border-primary">
          {value ? <StoreIcon name={value} weight={weight} className="size-5 text-primary" /> : <span className="size-5 rounded-full border border-dashed" aria-hidden />}
          <span className="flex-1 truncate">{value ? value.replace(/([a-z])([A-Z])/g, "$1 $2") : "No icon"}</span>
          <span className="font-medium text-primary">Change</span>
        </button>
        {allowNone && value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>Remove</Button>}
      </div>
      <IconPickerDialog open={open} value={value} weight={weight} onPick={onChange} onClose={() => setOpen(false)} />
    </div>
  );
}

export function IconWeightField({ value, onChange }: { value: IconWeight; onChange: (w: IconWeight) => void }) {
  return <SelectField label="Icon style" value={value} onChange={onChange} options={(Object.keys(WEIGHT_LABEL) as IconWeight[]).map((w) => ({ value: w, label: WEIGHT_LABEL[w] }))} />;
}
