"use client";

import { useState } from "react";
import { AlertTriangle, Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/pp/segmented";
import { ThemePicker } from "@/components/pp/theme-picker";
import { BaseDesign } from "@/components/store-admin/base-design";
import { AnnouncementEditor, OrderBumpEditor } from "@/components/store-admin/design-panels";
import { HeaderEditor } from "@/components/store-admin/header-editor";
import { TargetOptionsProvider } from "@/components/store-admin/target-select";
import type { RenderContext } from "@/lib/api";
import type { SiteDraft } from "@/lib/pages/editor-store";
import { newSchemeId, schemesOf, schemeWarnings } from "@/lib/store-themes";
import type { ColorScheme, SchemeColors, SocialLinks, StoreDesign, StoreTheme } from "@/lib/types";
import { ColorField, SchemeField } from "./controls";
import { SITE_PARTS, type SitePart } from "./canvas";
import { useEditor } from "./editor-context";
import { SiteLayoutEditor, SiteStylePicker } from "./site-style-panel";

/** The store-wide settings and a setter that records undo, for the panels below */
function useSite() {
  const site = useEditor((s) => s.site);
  const updateSite = useEditor((s) => s.updateSite);
  const setDesign = (fn: (d: StoreDesign) => StoreDesign, key?: string) => updateSite((s) => ({ ...s, design: fn(s.design) }), key);
  const setTheme = (patch: Partial<StoreTheme>, key?: string) => setDesign((d) => ({ ...d, theme: { ...d.theme, ...patch } }), key);
  return { site, updateSite, setDesign, setTheme };
}

/* Colour schemes ------------------------------------------------------------ */

const FIELDS: { key: keyof SchemeColors; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
  { key: "button", label: "Buttons and links" },
  { key: "buttonText", label: "Button labels" },
  { key: "border", label: "Lines and borders" },
];

function SchemePreview({ c, name }: { c: SchemeColors; name: string }) {
  return (
    <span className="flex items-center gap-2" aria-hidden>
      <span className="flex h-7 w-11 shrink-0 items-center justify-center gap-1 rounded-[6px] border text-xs font-bold" style={{ background: c.background, color: c.text, borderColor: c.border }}>
        Aa
        <span className="h-2 w-2 rounded-full" style={{ background: c.button }} />
      </span>
      <span className="truncate text-sm font-medium">{name}</span>
    </span>
  );
}

/**
 * Named colour schemes, like Shopify's. Each section, the header and the footer pick one. Each
 * scheme has its light and dark colours; the side shown follows the editor's Light/Dark preview.
 */
export function SchemesEditor({ mode }: { mode: "light" | "dark" }) {
  const { site, setTheme } = useSite();
  const [side, setSide] = useState<"light" | "dark">(mode);
  const [open, setOpen] = useState<string>();
  if (!site) return null;
  const theme = site.design.theme;
  const schemes = schemesOf(theme);
  const own = !!theme.schemes?.length;
  const save = (next: ColorScheme[], key?: string) => setTheme({ schemes: next }, key);
  const put = (id: string, fn: (s: ColorScheme) => ColorScheme, key?: string) => save(schemes.map((s) => (s.id === id ? fn(s) : s)), key);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Sections, the header and the footer each pick a scheme. Change a scheme here and everything using it follows.</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Editing</span>
        <Segmented label="Which colours to edit" value={side} onChange={setSide} options={[{ value: "light", label: "Light mode" }, { value: "dark", label: "Dark mode" }]} />
      </div>
      <ul className="flex flex-col gap-2">
        {schemes.map((sc) => {
          const c = sc[side];
          const warnings = schemeWarnings(c);
          const expanded = open === sc.id;
          return (
            <li key={sc.id} className="rounded-control border">
              <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? undefined : sc.id)} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left">
                <SchemePreview c={c} name={sc.name} />
                {warnings.length > 0 && <AlertTriangle className="size-4 shrink-0 text-warning" aria-label="Hard to read" />}
              </button>
              {expanded && (
                <div className="flex flex-col gap-4 border-t p-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`sc-name-${sc.id}`}>Name</Label>
                    <Input id={`sc-name-${sc.id}`} value={sc.name} maxLength={30} onChange={(e) => put(sc.id, (s) => ({ ...s, name: e.target.value }), `name-${sc.id}`)} />
                  </div>
                  {FIELDS.map((f) => (
                    <ColorField key={f.key} label={f.label} value={c[f.key]} swatches={[c[f.key], "#FFFFFF", "#F5F6F4", "#0C1F1B", "#000000", theme.brand ?? "#0F3D33"]} onChange={(v) => put(sc.id, (s) => ({ ...s, [side]: { ...s[side], [f.key]: v } }))} />
                  ))}
                  {warnings.map((w) => (
                    <p key={w} role="status" className="flex items-start gap-2 rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {w}
                    </p>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => put(sc.id, (s) => ({ ...s, [side === "light" ? "dark" : "light"]: s[side] }))}>
                      <Copy aria-hidden /> Use for {side === "light" ? "dark" : "light"} mode too
                    </Button>
                    {schemes.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => save(schemes.filter((s) => s.id !== sc.id))}>
                        <Trash2 aria-hidden /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        {schemes.length < 12 && (
          <Button type="button" variant="secondary" size="sm" onClick={() => { const id = newSchemeId(schemes); save([...schemes, { ...structuredClone(schemes[0]), id, name: `Scheme ${schemes.length + 1}` }]); setOpen(id); }}>
            <Plus aria-hidden /> Add scheme
          </Button>
        )}
        {own && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setTheme({ schemes: undefined })} title="Go back to the schemes made from your palette and brand colour">
            <RotateCcw aria-hidden /> Reset to palette
          </Button>
        )}
      </div>
      {!own && <p className="text-xs text-muted-foreground">These follow your palette and brand colour until you change one.</p>}
    </div>
  );
}

/* Social links -------------------------------------------------------------- */

const SOCIALS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/you" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@you" },
  { key: "x", label: "X", placeholder: "https://x.com/you" },
  { key: "website", label: "Website", placeholder: "https://" },
];

function SocialFields() {
  const { site, setDesign } = useSite();
  if (!site) return null;
  return (
    <div className="flex flex-col gap-3">
      {SOCIALS.map((s) => (
        <div key={s.key} className="flex flex-col gap-1.5">
          <Label htmlFor={`soc-${s.key}`}>{s.label}</Label>
          <Input id={`soc-${s.key}`} type="url" inputMode="url" value={site.design.socials[s.key] ?? ""} placeholder={s.placeholder} maxLength={300} onChange={(e) => setDesign((d) => ({ ...d, socials: { ...d.socials, [s.key]: e.target.value || undefined } }), `social-${s.key}`)} />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Shown in your store&apos;s footer. Only https links are shown.</p>
    </div>
  );
}

/* Theme settings (left sidebar tab) ------------------------------------------ */

/** Everything that applies to the whole store, in one place: brand, schemes, type, buttons, mode, logo, socials, checkout */
export function ThemeSettingsPanel({ context, mode }: { context: RenderContext; mode: "light" | "dark" }) {
  const { site, updateSite, setDesign, setTheme } = useSite();
  if (!site) return <p className="p-2 text-sm text-muted-foreground">Theme settings aren&apos;t available here.</p>;
  return (
    <Accordion type="multiple" defaultValue={["type"]} className="flex flex-col">
      <AccordionItem value="type">
        <AccordionTrigger className="min-h-11">Site template</AccordionTrigger>
        <AccordionContent>
          <SiteStylePicker />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="layout">
        <AccordionTrigger className="min-h-11">Layout</AccordionTrigger>
        <AccordionContent>
          <SiteLayoutEditor />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="brand">
        <AccordionTrigger className="min-h-11">Logo, brand colour, fonts and corners</AccordionTrigger>
        <AccordionContent>
          <BaseDesign value={{ design: site.design, logo: site.logo }} onChange={(v: SiteDraft) => updateSite(() => v, "base")} />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="schemes">
        <AccordionTrigger className="min-h-11">Colour schemes</AccordionTrigger>
        <AccordionContent>
          <SchemesEditor mode={mode} />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="palette">
        <AccordionTrigger className="min-h-11">Palette and accent</AccordionTrigger>
        <AccordionContent>
          <ThemePicker theme={site.design.theme} onChange={(theme) => setTheme(theme, "palette")} />
          {site.design.theme.schemes?.length ? <p className="mt-3 text-xs text-muted-foreground">You&apos;ve edited your colour schemes, so they keep their own colours. Reset them under Colour schemes to follow a new palette.</p> : null}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="social">
        <AccordionTrigger className="min-h-11">Social links</AccordionTrigger>
        <AccordionContent>
          <SocialFields />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="checkout">
        <AccordionTrigger className="min-h-11">Checkout add-on</AccordionTrigger>
        <AccordionContent>
          <OrderBumpEditor design={site.design} products={context.products} onChange={(d) => setDesign(() => d)} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/* The announcement bar, header and footer (right sidebar) ----------------------- */

export function SitePartPanel({ part, context, mode }: { part: SitePart; context: RenderContext; mode: "light" | "dark" }) {
  const { site, setDesign } = useSite();
  if (!site) return null;
  const d = site.design;
  const announcement = d.sections.find((s) => s.id === "announcement");
  return (
    <TargetOptionsProvider value={{ products: context.products, collections: context.collections, sections: [] }}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-semibold">{SITE_PARTS[part]}</p>
          <p className="text-xs text-muted-foreground">Part of every page of your store. Changes here show everywhere.</p>
        </div>
        {part === "@announcement" && (
          <>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
              Show the announcement bar
              <Switch
                checked={!!announcement?.enabled}
                onCheckedChange={(on) => setDesign((x) => ({ ...x, sections: x.sections.some((s) => s.id === "announcement") ? x.sections.map((s) => (s.id === "announcement" ? { ...s, enabled: on } : s)) : [{ id: "announcement", enabled: on }, ...x.sections] }))}
                aria-label="Show the announcement bar"
              />
            </label>
            <AnnouncementEditor design={d} onChange={(next) => setDesign(() => next, "announcement")} />
          </>
        )}
        {part === "@header" && (
          <>
            <SchemeField value={d.header?.scheme ?? ""} onChange={(scheme) => setDesign((x) => ({ ...x, header: { ...x.header, scheme: scheme || undefined } }))} theme={d.theme} mode={mode} noneLabel="Store default" />
            <HeaderEditor header={d.header ?? {}} onChange={(header) => setDesign((x) => ({ ...x, header }), "header")} />
            <p className="text-xs text-muted-foreground">Your logo and store name are under Theme settings.</p>
          </>
        )}
        {part === "@footer" && (
          <>
            <SchemeField value={d.footer?.scheme ?? ""} onChange={(scheme) => setDesign((x) => ({ ...x, footer: { ...x.footer, scheme: scheme || undefined } }))} theme={d.theme} mode={mode} noneLabel="Store default" />
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-sm font-medium">Social links</legend>
              <SocialFields />
            </fieldset>
            <p className="text-xs text-muted-foreground">Footer links follow your pages: published pages appear under Shop.</p>
          </>
        )}
      </div>
    </TargetOptionsProvider>
  );
}
