"use client";

import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/pp/segmented";
import { layoutOf, SITE_STYLES, styleById, styleDoc, type SiteStyleDef } from "@/lib/site-styles";
import { themeVars } from "@/lib/store-themes";
import type { PaletteId, SiteLayout, SiteStyleId, StoreTheme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEditor } from "./editor-context";

/**
 * A living preview of a site type, drawn in this store's own colours, fonts and corners (so it
 * changes the moment the palette or accent does). It moves while hovered or chosen: tiles float,
 * a sheen crosses the hero, the headline settles in.
 */
function LivePreview({ s, theme, mode }: { s: SiteStyleDef; theme: StoreTheme; mode: "light" | "dark" }) {
  const vars = themeVars({ ...theme, siteStyle: s.id, layout: undefined, corners: s.corners, fonts: s.fonts }, mode) as React.CSSProperties;
  const inset = s.layout.width === "full" ? "px-0" : s.layout.width === "narrow" ? "px-5" : s.layout.width === "wide" ? "px-1.5" : "px-3";
  const gap = s.layout.spacing === "airy" ? "gap-2.5" : s.layout.spacing === "compact" ? "gap-1" : "gap-1.5";
  const head = s.layout.headings === "huge" ? "text-[0.95rem]" : s.layout.headings === "large" ? "text-[0.8rem]" : s.layout.headings === "small" ? "text-[0.6rem]" : "text-[0.7rem]";
  const centered = s.headerAlign === "center" || s.id === "minimal" || s.id === "editorial";
  const round = s.corners === "round" ? "rounded-full" : s.corners === "sharp" ? "rounded-none" : "rounded-[3px]";
  const tile = s.corners === "round" ? "rounded-[8px]" : s.corners === "sharp" ? "rounded-none" : "rounded-[4px]";
  return (
    <span aria-hidden data-theme={mode} style={vars} className={cn("flex h-28 w-full flex-col overflow-hidden rounded-[8px] border bg-[var(--background)] p-1.5 text-[var(--foreground)]", gap)}>
      <span className={cn("flex items-center gap-1", centered ? "justify-center" : "justify-between")}>
        <span className={cn("block size-2 bg-[var(--primary)]", round)} />
        {!centered && <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="block h-0.5 w-2 rounded-full bg-current opacity-40" />)}</span>}
      </span>
      <span className={cn("relative flex flex-col overflow-hidden", inset, gap, centered ? "items-center text-center" : "items-start", s.id === "freeflow" && "rounded-[4px] bg-[var(--primary-soft)] py-1.5 pl-1")}>
        <span className={cn("pp-on-hover font-display leading-none font-bold tracking-tight", head, s.id === "bold" && "uppercase")} style={{ animation: "pp-settle 2.4s ease-in-out infinite" }}>
          Aa Store
        </span>
        <span className="block h-1 w-1/2 rounded-full bg-current opacity-35" />
        <span className={cn("mt-0.5 block h-2 w-7 bg-[var(--primary)]", round)} />
        {/* The sheen that crosses the hero */}
        <span className="pp-on-hover pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" style={{ animation: "pp-sheen 2.4s ease-in-out infinite" }} />
      </span>
      {s.layout.dividers && <span className="h-px w-full bg-current opacity-20" />}
      <span className={cn("grid", inset, s.id === "informational" ? "grid-cols-1 gap-0.5" : "grid-cols-3 gap-1")}>
        {[0, 1, 2].map((i) =>
          s.id === "informational" ? (
            <span key={i} className="block h-0.5 rounded-full bg-current opacity-40" />
          ) : (
            <span key={i} className={cn("pp-float pp-on-hover block h-5", tile, i === 1 ? "bg-[var(--accent)]" : "bg-[var(--primary-soft)]")} style={{ animationDelay: `${i * 0.25}s` }} />
          )
        )}
      </span>
    </span>
  );
}

/** Ready-made looks to start from: a site type, a palette and a light or dark default, set in one go */
const STARTERS: { id: string; name: string; goodFor: string; style: SiteStyleId; palette: PaletteId; mode: "light" | "dark" }[] = [
  { id: "shopfront", name: "Shopfront", goodFor: "Lots of products, easy browsing", style: "blocks", palette: "emerald", mode: "light" },
  { id: "boutique", name: "Boutique", goodFor: "Crafts, fashion and stories", style: "editorial", palette: "terracotta", mode: "light" },
  { id: "launch", name: "Launch", goodFor: "Courses, drops and big launches", style: "bold", palette: "graphite", mode: "dark" },
];

/**
 * Start from a theme: one click sets the type of site, colours, fonts, corners and light or dark,
 * and re-lays out the page (one undo step). Content stays; colour schemes go back to the palette's.
 */
export function StarterThemes() {
  const site = useEditor((s) => s.site);
  const restyle = useEditor((s) => s.restyle);
  if (!site) return null;
  const t = site.design.theme;
  const currentId = STARTERS.find((x) => x.style === styleById(t.siteStyle).id && x.palette === t.palette && x.mode === (t.mode === "dark" ? "dark" : "light"))?.id;

  const apply = (x: (typeof STARTERS)[number]) => {
    const s = styleById(x.style);
    restyle(
      (d) => ({
        ...d,
        design: {
          ...d.design,
          theme: { ...d.design.theme, siteStyle: x.style, palette: x.palette, mode: x.mode, layout: undefined, schemes: undefined, accent: undefined, corners: s.corners, fonts: s.fonts },
          header: { ...d.design.header, align: s.headerAlign },
        },
      }),
      (doc) => styleDoc(doc, x.style)
    );
    toast.success(`Started from ${x.name}`, { description: "Change anything below. Undo with Ctrl Z." });
  };

  return (
    <div role="radiogroup" aria-label="Start from a theme" className="grid grid-cols-1 gap-2">
      {STARTERS.map((x) => {
        const on = x.id === currentId;
        return (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => apply(x)}
            className={cn("pp-live group relative grid grid-cols-[7.5rem_1fr] items-center gap-3 rounded-card border bg-surface p-2 text-left shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-lift", on && "border-primary ring-2 ring-primary/30 hover:border-primary")}
          >
            <LivePreview s={styleById(x.style)} theme={{ ...t, palette: x.palette, accent: undefined }} mode={x.mode} />
            <span className="flex min-w-0 flex-col gap-0.5 pr-6">
              <span className="text-sm font-semibold">{x.name}</span>
              <span className="text-xs text-muted-foreground">{x.goodFor}</span>
              <span className="text-[0.6875rem] text-muted-foreground">{styleById(x.style).name} · {x.mode === "dark" ? "Dark" : "Light"}</span>
            </span>
            {on && <Check className="absolute top-3 right-3 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" aria-hidden />}
          </button>
        );
      })}
    </div>
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
  const mode: "light" | "dark" = site.design.theme.mode === "dark" ? "dark" : "light";

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
              className={cn("pp-live group relative flex flex-col gap-2 rounded-card border bg-surface p-2 text-left shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-lift", on && "border-primary ring-2 ring-primary/30 hover:border-primary")}
            >
              {on && <Check className="absolute top-3 right-3 z-10 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" aria-hidden />}
              <LivePreview s={s} theme={site.design.theme} mode={mode} />
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
