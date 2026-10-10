"use client";

import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/pp/segmented";
import { layoutOf, SITE_STYLES, styleById, styleDoc, type SiteStyleDef } from "@/lib/site-styles";
import type { SiteLayout, SiteStyleId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEditor } from "./editor-context";

/** A tiny drawing of the type's page shape, so the choice can be seen before it's made */
function Sketch({ s }: { s: SiteStyleDef }) {
  const bar = "rounded-[2px] bg-current";
  const inset = s.layout.width === "full" ? "px-0" : s.layout.width === "narrow" ? "px-5" : s.layout.width === "wide" ? "px-1.5" : "px-3";
  const gap = s.layout.spacing === "airy" ? "gap-2.5" : s.layout.spacing === "compact" ? "gap-1" : "gap-1.5";
  const head = s.layout.headings === "huge" ? "h-3 w-4/5" : s.layout.headings === "large" ? "h-2.5 w-3/4" : s.layout.headings === "small" ? "h-1.5 w-1/2" : "h-2 w-2/3";
  const centered = s.headerAlign === "center" || s.id === "minimal";
  return (
    <span aria-hidden className={cn("flex h-24 w-full flex-col overflow-hidden rounded-[6px] border bg-background p-1.5 text-foreground/70", gap)}>
      <span className={cn("flex items-center gap-1", centered ? "justify-center" : "justify-between")}>
        <span className={cn(bar, "h-1 w-5")} />
        {!centered && <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className={cn(bar, "h-0.5 w-2 opacity-60")} />)}</span>}
      </span>
      <span className={cn("flex flex-col", inset, gap, s.id === "minimal" || s.id === "editorial" ? "items-center" : "items-start", s.id === "freeflow" && "bg-current/10 py-1.5 pl-1")}>
        <span className={cn(bar, head)} />
        <span className={cn(bar, "h-1 w-1/2 opacity-50")} />
      </span>
      {s.layout.dividers && <span className="h-px w-full bg-current/30" />}
      <span className={cn("grid", inset, s.id === "informational" ? "grid-cols-1 gap-0.5" : "grid-cols-3 gap-1")}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn(s.id === "informational" ? "h-0.5 opacity-50" : "h-4 opacity-25", bar, s.corners === "round" ? "rounded-full" : s.corners === "sharp" ? "rounded-none" : "")} />
        ))}
      </span>
    </span>
  );
}

/**
 * The type of site. One choice for the whole store: it sets the layout, headings, corners, fonts,
 * header and footer of every page. Switching also re-lays out the page on screen (one undo step);
 * other pages pick up the new look straight away and keep their content.
 */
export function SiteStylePicker() {
  const site = useEditor((s) => s.site);
  const restyle = useEditor((s) => s.restyle);
  if (!site) return null;
  const current = styleById(site.design.theme.siteStyle).id;

  const choose = (id: SiteStyleId) => {
    if (id === current) return;
    const s = styleById(id);
    restyle(
      (x) => ({
        ...x,
        design: {
          ...x.design,
          theme: { ...x.design.theme, siteStyle: id, layout: undefined, corners: s.corners, fonts: s.fonts },
          header: { ...x.design.header, align: s.headerAlign },
        },
      }),
      (d) => styleDoc(d, id)
    );
    toast.success(`Your site is now ${s.name}`, { description: "Every page uses it. Undo with Ctrl Z." });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">One type for the whole store. Every page follows it, so your site always looks like one site.</p>
      <div role="radiogroup" aria-label="Type of site" className="grid grid-cols-2 gap-2">
        {SITE_STYLES.map((s) => {
          const on = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(s.id)}
              className={cn("relative flex flex-col gap-2 rounded-control border bg-surface p-2 text-left transition-colors hover:border-border-strong", on && "border-primary ring-2 ring-primary/30 hover:border-primary")}
            >
              {on && <Check className="absolute top-3 right-3 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" aria-hidden />}
              <Sketch s={s} />
              <span className="flex flex-col px-0.5">
                <span className="text-sm font-semibold">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.goodFor}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{styleById(current).description}</p>
    </div>
  );
}

/** The whole site's layout: the type's, changed here part by part. */
export function SiteLayoutEditor() {
  const site = useEditor((s) => s.site);
  const updateSite = useEditor((s) => s.updateSite);
  if (!site) return null;
  const theme = site.design.theme;
  const l = layoutOf(theme);
  const changed = !!theme.layout && Object.values(theme.layout).some((v) => v !== undefined);
  const set = (patch: Partial<SiteLayout>) => updateSite((x) => ({ ...x, design: { ...x.design, theme: { ...x.design.theme, layout: { ...x.design.theme.layout, ...patch } } } }));
  const header = site.design.header?.align ?? styleById(theme.siteStyle).headerAlign;

  const row = (label: string, control: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {control}
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      {row("Content width", <Segmented label="Content width" value={l.width} onChange={(width) => set({ width })} options={[{ value: "narrow", label: "Narrow" }, { value: "standard", label: "Standard" }, { value: "wide", label: "Wide" }, { value: "full", label: "Full" }]} />)}
      {row("Space between sections", <Segmented label="Space between sections" value={l.spacing} onChange={(spacing) => set({ spacing })} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "airy", label: "Airy" }]} />)}
      {row("Heading size", <Segmented label="Heading size" value={l.headings} onChange={(headings) => set({ headings })} options={[{ value: "small", label: "S" }, { value: "medium", label: "M" }, { value: "large", label: "L" }, { value: "huge", label: "XL" }]} />)}
      {row("Header", <Segmented label="Header layout" value={header} onChange={(align) => updateSite((x) => ({ ...x, design: { ...x.design, header: { ...x.design.header, align } } }))} options={[{ value: "left", label: "Logo left" }, { value: "center", label: "Logo centred" }]} />)}
      {row("Footer", <Segmented label="Footer layout" value={l.footer} onChange={(footer) => set({ footer })} options={[{ value: "columns", label: "Columns" }, { value: "centered", label: "Centred" }, { value: "minimal", label: "Minimal" }]} />)}
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor="layout-dividers">Lines between sections</Label>
        <Switch id="layout-dividers" checked={l.dividers} onCheckedChange={(dividers) => set({ dividers })} />
      </div>
      <p className="text-xs text-muted-foreground">Applies to every page. Each section can still set its own width and spacing in its settings.</p>
      {changed && (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => updateSite((x) => ({ ...x, design: { ...x.design, theme: { ...x.design.theme, layout: undefined } } }))}>
          <RotateCcw aria-hidden /> Back to the {styleById(theme.siteStyle).name} layout
        </Button>
      )}
    </div>
  );
}
