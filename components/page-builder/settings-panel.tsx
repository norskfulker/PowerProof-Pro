"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Bold, ChevronRight, ClipboardCopy, ClipboardPaste, Copy, Eye, Italic, LayoutTemplate, Link2, Monitor, MousePointer2, Paintbrush, Plus, RotateCcw, Smartphone, Trash2, Type, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fieldLabel } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { RenderContext } from "@/lib/api";
import { BLOCK_LABELS, type EditorPanel } from "@/lib/pages/editor-store";
import Link from "next/link";
import { HtmlEditor } from "@/components/store-admin/html-editor";
import { BOOKING_ZONES, findNode, layoutSchema, locate, PROPS, sectionOf, styleSchema, type BlockProps, type BlockStyle, type PageNode } from "@/lib/pages/schema";
import { ChoiceField, IconField, IconWeightField, LinkField, MediaUploader, SchemeField, SelectField, SwitchField, TableEditor, TextField, BackgroundPicker, RangeField } from "./controls";
import { isSitePart } from "./canvas";
import { useEditor } from "./editor-context";
import { BLOCK_ICONS } from "./add-block-menu";
import { nodeLabel } from "./layers-panel";
import { SitePartPanel } from "./theme-settings";

const DEFAULT_STYLE = styleSchema.parse({});
/** Blocks whose alignment applies to what's inside them */
/** Opens another panel of the editor (About and FAQ are edited there, beside the page) */
function PanelLink({ panel, at, children }: { panel: EditorPanel; at?: string; children: React.ReactNode }) {
  const openPanel = useEditor((s) => s.openPanel);
  return (
    <button type="button" onClick={() => openPanel(panel, at)} className="inline font-medium text-primary underline underline-offset-4">
      {children}
    </button>
  );
}

const CONTAINERS = new Set(["section", "hero", "columns", "column", "cards", "card"]);

type Patch = (patch: Record<string, unknown>, coalesceKey?: string) => void;

/** First validation message for a block's props, shown next to the form */
function propError(node: PageNode, field: string): string | undefined {
  const r = PROPS[node.type].safeParse(node.props);
  if (r.success) return undefined;
  return r.error.issues.find((i) => i.path[0] === field)?.message;
}

function insertMarkup(id: string, before: string, after: string, value: string, onChange: (v: string) => void) {
  const el = document.getElementById(id) as HTMLTextAreaElement | null;
  if (!el) return onChange(value + before + after);
  const { selectionStart: a, selectionEnd: b } = el;
  const picked = value.slice(a, b) || (before === "[" ? "link text" : "text");
  onChange(value.slice(0, a) + before + picked + after + value.slice(b));
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(a + before.length, a + before.length + picked.length);
  });
}

function RichTextField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = "rt-text";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={fieldLabel}>Text</label>
        <div role="group" aria-label="Formatting" className="flex gap-1 pointer-coarse:gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Bold" onClick={() => insertMarkup(id, "**", "**", value, onChange)}><Bold /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Italic" onClick={() => insertMarkup(id, "_", "_", value, onChange)}><Italic /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Link" onClick={() => insertMarkup(id, "[", "](https://)", value, onChange)}><Link2 /></Button>
        </div>
      </div>
      <Textarea id={id} rows={8} maxLength={4000} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-hint`} className="min-h-32" />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">Leave a blank line for a new paragraph. **bold**, _italic_ and [link](https://…) work.</p>
    </div>
  );
}

function ListEditor<T>({ items, onChange, make, render, label, max }: { items: T[]; onChange: (items: T[]) => void; make: () => T; render: (item: T, set: (v: T) => void, i: number) => React.ReactNode; label: string; max: number }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => (
        <fieldset key={i} className="flex flex-col gap-2 rounded-control border p-3">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">{label} {i + 1}</legend>
          {render(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}
          <Button type="button" variant="ghost" size="sm" className="self-start text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 aria-hidden /> Remove
          </Button>
        </fieldset>
      ))}
      {items.length < max && (
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onChange([...items, make()])}>
          <Plus aria-hidden /> Add {label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

function ContentForm({ node, set, context }: { node: PageNode; set: Patch; context: RenderContext }) {
  const productOptions = [{ value: "", label: "Pick a product" }, ...context.products.map((p) => ({ value: p.id, label: p.title }))];
  const blocks = useEditor((s) => s.doc.blocks);
  const sections = blocks.map((b) => ({ id: b.id, label: nodeLabel(b) }));
  const link = (label: string, value: string, onChange: (v: string) => void, field?: string, allowNone = true) => <LinkField label={label} value={value} onChange={onChange} context={context} sections={sections} allowNone={allowNone} error={field ? propError(node, field) : undefined} />;
  switch (node.type) {
    case "section":
      return <TextField label="Name (only you see this)" value={(node.props as BlockProps<"section">).label} max={60} onChange={(label) => set({ label }, "label")} />;
    case "column":
      return <p className="text-sm text-muted-foreground">A column holds blocks. Select one inside it, or add a block while the column is selected.</p>;
    case "columns": {
      const p = node.props as BlockProps<"columns">;
      return (
        <div className="flex flex-col gap-3.5">
          <ColumnsCount node={node} />
          {node.children.length === 2 && (
            <ChoiceField label="Widths" value={p.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: "equal", label: "Equal" }, { value: "2:1", label: "Wide left" }, { value: "1:2", label: "Wide right" }]} />
          )}
          <ChoiceField label="Line up" value={p.valign ?? "start"} onChange={(valign) => set({ valign })} options={[{ value: "start", label: "Top" }, { value: "center", label: "Middle" }, { value: "end", label: "Bottom" }]} />
          <SwitchField label="Stack on phones" checked={p.stackOnMobile} onChange={(stackOnMobile) => set({ stackOnMobile })} />
        </div>
      );
    }
    case "hero": {
      const p = node.props as BlockProps<"hero">;
      return (
        <div className="flex flex-col gap-3.5">
          <TextField label="Headline" value={p.headline} max={120} onChange={(v) => set({ headline: v }, "headline")} error={propError(node, "headline")} />
          <TextField label="Supporting text" value={p.subtext} max={300} multiline onChange={(v) => set({ subtext: v }, "subtext")} />
          <TextField label="Small line above (optional)" value={p.eyebrow} max={60} onChange={(v) => set({ eyebrow: v }, "eyebrow")} />
          <fieldset className="flex flex-col gap-3 rounded-control border p-3">
            <legend className={cn("px-1", fieldLabel)}>Main button</legend>
            <TextField label="Label" value={p.ctaLabel} max={40} onChange={(v) => set({ ctaLabel: v }, "cta")} hint="Leave empty for no button." />
            {p.ctaLabel && link("Goes to", p.ctaHref, (v) => set({ ctaHref: v }, "href"), "ctaHref")}
          </fieldset>
          <fieldset className="flex flex-col gap-3 rounded-control border p-3">
            <legend className={cn("px-1", fieldLabel)}>Second button (optional)</legend>
            <TextField label="Label" value={p.cta2Label ?? ""} max={40} onChange={(v) => set({ cta2Label: v }, "cta2")} />
            {p.cta2Label && link("Goes to", p.cta2Href ?? "", (v) => set({ cta2Href: v }, "href2"), "cta2Href")}
          </fieldset>
          <ChoiceField label="Layout" value={p.layout} onChange={(layout) => set({ layout })} options={[{ value: "left", label: "Words only" }, { value: "centered", label: "Centred" }, { value: "split", label: "With pictures" }]} />
          {p.layout === "split" && (
            <>
              <MediaUploader label="Picture" value={p.image} kinds={["image", "gif"]} context={context} onChange={(image) => set({ image })} />
              <TextField label="Describe the picture" value={p.imageAlt} max={200} onChange={(v) => set({ imageAlt: v }, "alt")} />
              {p.image && [0, 1].map((i) => (
                <MediaUploader key={i} label={`Extra picture ${i + 1} (optional)`} value={(p.moreImages ?? [])[i] ?? ""} kinds={["image", "gif"]} context={context} onChange={(src) => { const more = [...(p.moreImages ?? [])]; more[i] = src; set({ moreImages: more.filter(Boolean).slice(0, 2) }); }} />
              ))}
            </>
          )}
          <p className="text-xs text-muted-foreground">For a picture or video behind the words, use Style › Background.</p>
        </div>
      );
    }
    case "heading": {
      const p = node.props as BlockProps<"heading">;
      return (
        <div className="flex flex-col gap-3.5">
          <TextField label="Text" value={p.text} max={160} onChange={(text) => set({ text }, "text")} error={propError(node, "text")} />
          <ChoiceField label="Size" value={p.size} onChange={(size) => set({ size })} options={[{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }, { value: "xl", label: "XL" }]} />
          <ChoiceField label="Level (for screen readers)" value={String(p.level) as "1" | "2" | "3"} onChange={(v) => set({ level: Number(v) })} options={[{ value: "1", label: "H1" }, { value: "2", label: "H2" }, { value: "3", label: "H3" }]} />
          <TextField label="Link on the right (optional)" value={p.linkLabel ?? ""} max={40} placeholder="View all" onChange={(linkLabel) => set({ linkLabel }, "linkLabel")} />
          {p.linkLabel && link("Link goes to", p.linkHref ?? "", (linkHref) => set({ linkHref }, "linkHref"), "linkHref")}
        </div>
      );
    }
    case "text": {
      const p = node.props as BlockProps<"text">;
      return (
        <div className="flex flex-col gap-3.5">
          <RichTextField value={p.text} onChange={(text) => set({ text }, "text")} />
          <ChoiceField label="Size" value={p.size} onChange={(size) => set({ size })} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Normal" }, { value: "lg", label: "Large" }]} />
        </div>
      );
    }
    case "button": {
      const p = node.props as BlockProps<"button">;
      return (
        <div className="flex flex-col gap-3.5">
          <TextField label="Label" value={p.label} max={40} onChange={(label) => set({ label }, "label")} error={propError(node, "label")} />
          <ChoiceField label="When tapped" value={p.action} onChange={(action) => set({ action })} options={[{ value: "link", label: "Open a link" }, { value: "product", label: "Go to a product" }]} />
          {p.action === "link" ? (
            link("Goes to", p.href, (href) => set({ href }, "href"), "href")
          ) : (
            <SelectField label="Product" value={p.productId} onChange={(productId) => set({ productId })} options={productOptions} />
          )}
          <ChoiceField label="Style" value={p.variant} onChange={(variant) => set({ variant })} options={[{ value: "primary", label: "Solid" }, { value: "secondary", label: "Outline" }, { value: "brass", label: "Brass" }]} />
          <ChoiceField label="Size" value={p.size} onChange={(size) => set({ size })} options={[{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }]} />
        </div>
      );
    }
    case "image": {
      const p = node.props as BlockProps<"image">;
      return (
        <div className="flex flex-col gap-3.5">
          <MediaUploader label="Image" value={p.src} kinds={["image", "gif"]} context={context} onChange={(src) => set({ src })} />
          <TextField label="Describe it (for screen readers)" value={p.alt} max={200} onChange={(alt) => set({ alt }, "alt")} />
          <SelectField label="Shape" value={p.aspect} onChange={(aspect) => set({ aspect })} options={[{ value: "4:3", label: "4:3" }, { value: "1:1", label: "Square" }, { value: "16:9", label: "Wide 16:9" }, { value: "3:4", label: "Tall 3:4" }, { value: "auto", label: "Original" }]} />
          <ChoiceField label="Fit" value={p.fit} onChange={(fit) => set({ fit })} options={[{ value: "cover", label: "Fill" }, { value: "contain", label: "Fit" }]} />
          <div className="grid grid-cols-2 gap-3">
            <RangeField label="Focus across" value={p.focal.x} min={0} max={100} step={5} suffix="%" onChange={(x) => set({ focal: { ...p.focal, x } }, "fx")} />
            <RangeField label="Focus down" value={p.focal.y} min={0} max={100} step={5} suffix="%" onChange={(y) => set({ focal: { ...p.focal, y } }, "fy")} />
          </div>
          <TextField label="Caption" value={p.caption} max={200} onChange={(caption) => set({ caption }, "caption")} />
          {link("Clicking it goes to", p.href ?? "", (href) => set({ href }, "href"), "href")}
        </div>
      );
    }
    case "gallery": {
      const p = node.props as BlockProps<"gallery">;
      return (
        <div className="flex flex-col gap-3.5">
          <ChoiceField label="Columns" value={String(p.columns) as "2" | "3" | "4"} onChange={(v) => set({ columns: Number(v) })} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
          <ListEditor label="Image" max={12} items={p.images} make={() => ({ src: "", alt: "" })} onChange={(images) => set({ images })} render={(img, setImg) => (
            <>
              <MediaUploader label="File" value={img.src} kinds={["image", "gif"]} context={context} onChange={(src) => setImg({ ...img, src })} />
              <TextField label="Describe it" value={img.alt} max={200} onChange={(alt) => setImg({ ...img, alt })} />
            </>
          )} />
        </div>
      );
    }
    case "video": {
      const p = node.props as BlockProps<"video">;
      return (
        <div className="flex flex-col gap-3.5">
          <MediaUploader label="Upload a video" value={/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com)\//.test(p.src) ? "" : p.src} kinds={["video"]} context={context} onChange={(src) => set({ src })} />
          <TextField label="Or a YouTube or Vimeo link" value={/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com)\//.test(p.src) ? p.src : ""} placeholder="https://youtube.com/watch?v=…" max={300} onChange={(src) => set({ src: src.trim() }, "url")} hint="Plays in YouTube's privacy-enhanced player, or Vimeo's." />
          <MediaUploader label="Poster image" value={p.poster} kinds={["image"]} context={context} onChange={(poster) => set({ poster })} />
          <SelectField label="Shape" value={p.aspect ?? "16:9"} onChange={(aspect) => set({ aspect })} options={[{ value: "16:9", label: "Wide 16:9" }, { value: "4:3", label: "4:3" }, { value: "1:1", label: "Square" }, { value: "9:16", label: "Tall 9:16 (phone video)" }]} />
          <SwitchField label="Play on its own, muted and looping" checked={!!p.autoplay} onChange={(autoplay) => set({ autoplay })} hint="Good for short clips. Visitors who prefer less motion can still pause it." />
          <TextField label="Caption" value={p.caption} max={200} onChange={(caption) => set({ caption }, "caption")} />
        </div>
      );
    }
    case "table": {
      const p = node.props as BlockProps<"table">;
      return (
        <div className="flex flex-col gap-3.5">
          <TableEditor rows={p.rows} onChange={(rows, key) => set({ rows }, key)} />
          <SwitchField label="First row is the header" checked={p.header} onChange={(header) => set({ header })} />
          <SwitchField label="Striped rows" checked={p.striped} onChange={(striped) => set({ striped })} />
        </div>
      );
    }
    case "divider":
      return <p className="text-sm text-muted-foreground">A thin line between blocks. Nothing to set.</p>;
    case "spacer": {
      const p = node.props as BlockProps<"spacer">;
      return <ChoiceField label="Height" value={p.size} onChange={(size) => set({ size })} options={[{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }, { value: "xl", label: "XL" }]} />;
    }
    case "product_card": {
      const p = node.props as BlockProps<"product_card">;
      return (
        <div className="flex flex-col gap-3.5">
          <SelectField label="Product" value={p.productId} onChange={(productId) => set({ productId })} options={productOptions} />
          <SwitchField label="Show Buy now" checked={p.showBuy} onChange={(showBuy) => set({ showBuy })} />
        </div>
      );
    }
    case "product_grid": {
      const p = node.props as BlockProps<"product_grid">;
      return (
        <div className="flex flex-col gap-3.5">
          <ChoiceField label="Show" value={p.source} onChange={(source) => set({ source })} options={[{ value: "all", label: "Everything" }, { value: "collection", label: "A collection" }, { value: "manual", label: "Picked" }]} />
          {p.source === "collection" && <SelectField label="Collection" value={p.collectionSlug || "none"} onChange={(v) => set({ collectionSlug: v === "none" ? "" : v })} options={[{ value: "none", label: "Pick a collection" }, ...context.collections.map((c) => ({ value: c.slug, label: c.name }))]} />}
          {p.source === "manual" && (
            <fieldset className="flex flex-col gap-1">
              <legend className={cn("mb-1", fieldLabel)}>Products ({p.productIds.length})</legend>
              <div className="rounded-control border">
                {context.products.map((prod) => (
                  <label key={prod.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b px-3 text-sm last:border-b-0">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={p.productIds.includes(prod.id)} onChange={(e) => set({ productIds: e.target.checked ? [...p.productIds, prod.id] : p.productIds.filter((x) => x !== prod.id) })} />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{prod.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <SelectField label="Order" value={p.sort ?? "featured"} onChange={(sort) => set({ sort })} options={[{ value: "featured", label: p.source === "manual" ? "As picked" : "Newest first (default)" }, { value: "popular", label: "Bestsellers first" }, { value: "newest", label: "Newest first" }, { value: "price-asc", label: "Price, low to high" }, { value: "price-desc", label: "Price, high to low" }]} />
          <RangeField label="How many" value={p.limit} min={1} max={24} step={1} onChange={(limit) => set({ limit }, "limit")} />
          <ChoiceField label="Columns on desktop" value={String(p.columns) as "2" | "3" | "4"} onChange={(v) => set({ columns: Number(v) })} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
        </div>
      );
    }
    case "highlights": {
      const p = node.props as BlockProps<"highlights">;
      const weight = p.iconWeight ?? "regular";
      const autoIcons = p.autoIcons ?? ["DownloadSimple", "ShieldCheck", "ArrowCounterClockwise", "Star"];
      return (
        <div className="flex flex-col gap-3.5">
          <ChoiceField label="Show" value={p.source ?? "manual"} onChange={(source) => set({ source, ...(source === "manual" && !p.items.length ? { items: [{ icon: autoIcons[0], title: "Instant download", body: "Right after paying" }, { icon: autoIcons[1], title: "Secure payment", body: "UPI, cards, netbanking" }, { icon: autoIcons[2], title: "Easy refunds", body: "If it isn't right" }] } : {}) })} options={[{ value: "auto", label: "Automatic" }, { value: "manual", label: "My own points" }]} />
          <ChoiceField label="Look" value={p.look ?? "strip"} onChange={(look) => set({ look })} options={[{ value: "strip", label: "One strip" }, { value: "cards", label: "Separate cards" }]} />
          <IconWeightField value={weight} onChange={(iconWeight) => set({ iconWeight })} />
          {p.source === "auto" ? (
            <>
              <p className="text-sm text-muted-foreground">Instant download, secure payment, your refund window and your rating (once you have reviews), kept up to date for you. Click an icon on the page, or pick one here.</p>
              {["Download", "Payment", "Refunds", "Rating"].map((label, i) => (
                <IconField key={label} label={`${label} icon`} value={autoIcons[i]} weight={weight} onChange={(icon) => set({ autoIcons: autoIcons.map((x, j) => (j === i ? icon : x)) })} />
              ))}
            </>
          ) : (
            <ListEditor label="Point" max={6} items={p.items} make={() => ({ icon: "Check", title: "New point", body: "" })} onChange={(items) => set({ items })} render={(it, setIt) => (
              <>
                <IconField value={it.icon} weight={weight} onChange={(icon) => setIt({ ...it, icon })} />
                <TextField label="Title" value={it.title} max={60} onChange={(title) => setIt({ ...it, title })} />
                <TextField label="Line" value={it.body} max={160} onChange={(body) => setIt({ ...it, body })} />
              </>
            )} />
          )}
        </div>
      );
    }
    case "testimonials": {
      const p = node.props as BlockProps<"testimonials">;
      return (
        <div className="flex flex-col gap-3.5">
          <ChoiceField label="Show" value={p.source} onChange={(source) => set({ source })} options={[{ value: "reviews", label: "Best reviews" }, { value: "manual", label: "Write my own" }]} />
          {p.source === "reviews" ? (
            <RangeField label="How many" value={p.limit} min={1} max={6} step={1} onChange={(limit) => set({ limit }, "limit")} />
          ) : (
            <ListEditor label="Quote" max={6} items={p.items} make={() => ({ quote: "", author: "" })} onChange={(items) => set({ items })} render={(it, setIt) => (
              <>
                <TextField label="Quote" value={it.quote} max={400} multiline onChange={(quote) => setIt({ ...it, quote })} />
                <TextField label="Who said it" value={it.author} max={60} onChange={(author) => setIt({ ...it, author })} />
              </>
            )} />
          )}
        </div>
      );
    }
    case "faq": {
      const p = node.props as BlockProps<"faq">;
      return (
        <div className="flex flex-col gap-3.5">
          <ChoiceField label="Questions" value={p.source ?? "manual"} onChange={(source) => set({ source })} options={[{ value: "store", label: "From my FAQ page" }, { value: "manual", label: "Write them here" }]} />
          {p.source === "store" ? (
            <>
              <RangeField label="How many" value={p.limit ?? 5} min={1} max={20} step={1} onChange={(limit) => set({ limit }, "limit")} />
              <p className="text-sm text-muted-foreground">Shared with your FAQ page. <PanelLink panel="content" at="faq">Edit the questions</PanelLink></p>
            </>
          ) : (
            <ListEditor label="Question" max={20} items={p.items} make={() => ({ q: "", a: "" })} onChange={(items) => set({ items })} render={(it, setIt) => (
              <>
                <TextField label="Question" value={it.q} max={200} onChange={(q) => setIt({ ...it, q })} />
                <TextField label="Answer" value={it.a} max={1000} multiline onChange={(a) => setIt({ ...it, a })} />
              </>
            )} />
          )}
        </div>
      );
    }
    case "cards": {
      const p = node.props as BlockProps<"cards">;
      return (
        <div className="flex flex-col gap-3.5">
          <ChoiceField label="Columns on desktop" value={String(p.columns) as "2" | "3" | "4"} onChange={(v) => set({ columns: Number(v) })} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} />
          <ChoiceField label="Look" value={p.look} onChange={(look) => set({ look })} options={[{ value: "card", label: "Cards" }, { value: "plain", label: "Plain" }]} />
          <SelectField label="Picture shape" value={p.aspect} onChange={(aspect) => set({ aspect })} options={[{ value: "4:3", label: "4:3" }, { value: "1:1", label: "Square" }, { value: "16:9", label: "Wide 16:9" }, { value: "3:4", label: "Tall 3:4" }, { value: "none", label: "No pictures" }]} />
          <CardsCount node={node} />
          <p className="text-xs text-muted-foreground">Select a card on the page or in the sidebar to change its words, picture and link.</p>
        </div>
      );
    }
    case "card": {
      const p = node.props as BlockProps<"card">;
      return (
        <div className="flex flex-col gap-3.5">
          <IconField label="Icon (optional)" value={p.icon ?? ""} weight={p.iconWeight ?? "duotone"} allowNone onChange={(icon) => set({ icon })} />
          {p.icon && <IconWeightField value={p.iconWeight ?? "duotone"} onChange={(iconWeight) => set({ iconWeight })} />}
          <MediaUploader label="Picture" value={p.image} kinds={["image", "gif"]} context={context} onChange={(image) => set({ image })} />
          {p.image && <TextField label="Describe the picture" value={p.imageAlt} max={200} onChange={(imageAlt) => set({ imageAlt }, "alt")} />}
          <TextField label="Title" value={p.title} max={120} onChange={(title) => set({ title }, "title")} />
          <TextField label="Text" value={p.text} max={600} multiline onChange={(text) => set({ text }, "text")} />
          <TextField label="Link label (optional)" value={p.ctaLabel} max={40} placeholder="Learn more" onChange={(ctaLabel) => set({ ctaLabel }, "cta")} />
          {p.ctaLabel && link("Link goes to", p.ctaHref, (ctaHref) => set({ ctaHref }, "href"), "ctaHref")}
        </div>
      );
    }
    case "collection_list": {
      const p = node.props as BlockProps<"collection_list">;
      return (
        <div className="flex flex-col gap-3.5">
          <RangeField label="How many" value={p.limit} min={1} max={12} step={1} onChange={(limit) => set({ limit }, "limit")} />
          <ChoiceField label="Columns on desktop" value={String(p.columns) as "2" | "3" | "4" | "6"} onChange={(v) => set({ columns: Number(v) })} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }, { value: "6", label: "6" }]} />
          <p className="text-sm text-muted-foreground">Collections with products show here in your order. <Link href="/catalog/collections" className="font-medium text-primary underline underline-offset-4">Manage collections</Link></p>
        </div>
      );
    }
    case "offers":
      return <p className="text-sm text-muted-foreground">Your live bundles show here, ready to buy. It stays empty until you have one. <Link href="/store/current/offers" className="font-medium text-primary underline underline-offset-4">Manage offers</Link></p>;
    case "about": {
      const p = node.props as BlockProps<"about">;
      return (
        <div className="flex flex-col gap-3.5">
          <SwitchField label="Link to your About page" checked={p.showLink} onChange={(showLink) => set({ showLink })} />
          <p className="text-sm text-muted-foreground">Your photo, name and story come from your About page. <PanelLink panel="content" at="about">Edit About</PanelLink></p>
        </div>
      );
    }
    case "marquee": {
      const p = node.props as BlockProps<"marquee">;
      const logos = p.mode === "logos";
      return (
        <div className="flex flex-col gap-3.5">
          <ChoiceField label="Shows" value={p.mode} onChange={(mode) => set({ mode })} options={[{ value: "text", label: "Words" }, { value: "logos", label: "Logos" }]} />
          <ListEditor label={logos ? "Logo" : "Phrase"} max={12} items={p.items} make={() => ({ text: "", src: "", alt: "", href: "" })} onChange={(items) => set({ items })} render={(it, setIt) => (
            <>
              {logos ? (
                <>
                  <MediaUploader label="Logo" value={it.src} kinds={["image"]} context={context} onChange={(src) => setIt({ ...it, src })} />
                  <TextField label="Whose logo (for screen readers)" value={it.alt} max={200} onChange={(alt) => setIt({ ...it, alt })} />
                </>
              ) : (
                <TextField label="Words" value={it.text} max={80} onChange={(text) => setIt({ ...it, text })} />
              )}
              {link("Links to", it.href, (href) => setIt({ ...it, href }))}
            </>
          )} />
          <ChoiceField label="Speed" value={p.speed} onChange={(speed) => set({ speed })} options={[{ value: "slow", label: "Slow" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Fast" }]} />
          <ChoiceField label="Moves" value={p.direction} onChange={(direction) => set({ direction })} options={[{ value: "left", label: "To the left" }, { value: "right", label: "To the right" }]} />
          <SwitchField label="Pause when pointed at" checked={p.pauseOnHover} onChange={(pauseOnHover) => set({ pauseOnHover })} />
          <p className="text-xs text-muted-foreground">It holds still in the editor so you can type into it, and stays still for visitors who prefer less motion.</p>
        </div>
      );
    }
    case "custom_html": {
      const p = node.props as BlockProps<"custom_html">;
      return <HtmlEditor value={p.source ? { name: p.name, source: p.source, height: p.height } : undefined} onChange={(v) => set({ name: v?.name ?? "", source: v?.source ?? "", height: v?.height })} />;
    }
    case "countdown": {
      const p = node.props as BlockProps<"countdown">;
      const local = p.endsAt ? new Date(new Date(p.endsAt).getTime() - new Date(p.endsAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
      return (
        <div className="flex flex-col gap-3.5">
          <TextField label="Label" value={p.label} max={80} onChange={(label) => set({ label }, "label")} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cd-end" className={fieldLabel}>Ends</label>
            <Input id="cd-end" type="datetime-local" value={local} onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
          </div>
        </div>
      );
    }
    case "newsletter": {
      const p = node.props as BlockProps<"newsletter">;
      return (
        <div className="flex flex-col gap-3.5">
          <TextField label="Heading" value={p.heading} max={100} onChange={(heading) => set({ heading }, "heading")} />
          <TextField label="Line below" value={p.body} max={240} onChange={(body) => set({ body }, "body")} />
          <p className="text-xs text-muted-foreground">Sign-ups appear in Sales › Leads.</p>
        </div>
      );
    }
    case "lead_form": {
      const p = node.props as BlockProps<"lead_form">;
      return (
        <div className="flex flex-col gap-3.5">
          <TextField label="Heading" value={p.heading} max={100} onChange={(heading) => set({ heading }, "heading")} />
          <TextField label="Line below" value={p.body} max={240} onChange={(body) => set({ body }, "body")} />
          <ListEditor
            label="Field"
            max={6}
            items={p.fields}
            make={() => ({ id: `f${Math.random().toString(36).slice(2, 8)}`, label: "New question", type: "text" as const, required: false })}
            onChange={(fields) => set({ fields })}
            render={(f, setF) => (
              <>
                <TextField label="Label" value={f.label} max={60} onChange={(label) => setF({ ...f, label })} />
                <SelectField label="Kind" value={f.type} onChange={(type) => setF({ ...f, type })} options={[{ value: "text", label: "Short text (name)" }, { value: "email", label: "Email" }, { value: "phone", label: "Phone" }, { value: "textarea", label: "Long answer" }]} />
                <SwitchField label="Required" checked={f.required} onChange={(required) => setF({ ...f, required })} />
              </>
            )}
          />
          {propError(node, "fields") && <p role="alert" className="text-sm font-medium text-danger">{propError(node, "fields")}</p>}
          <TextField label="Button label" value={p.buttonLabel} max={40} onChange={(buttonLabel) => set({ buttonLabel }, "buttonLabel")} />
          <TextField label="Message after sending" value={p.successMessage} max={240} multiline onChange={(successMessage) => set({ successMessage }, "successMessage")} />
          {link("After sending, go to", p.redirectHref, (redirectHref) => set({ redirectHref }, "redirectHref"), "redirectHref")}
          <p className="-mt-2 text-xs text-muted-foreground">Nowhere keeps them here with the message.</p>
          <p className="text-xs text-muted-foreground">Everyone who sends it appears in Sales › Leads.</p>
        </div>
      );
    }
    case "booking": {
      const p = node.props as BlockProps<"booking">;
      const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return (
        <div className="flex flex-col gap-3.5">
          <TextField label="Heading" value={p.heading} max={100} onChange={(heading) => set({ heading }, "heading")} />
          <TextField label="Line below" value={p.body} max={240} onChange={(body) => set({ body }, "body")} />
          <ChoiceField label="Length of a call" value={String(p.durationMin) as "15" | "30" | "45" | "60"} onChange={(v) => set({ durationMin: Number(v) })} options={[{ value: "15", label: "15 min" }, { value: "30", label: "30 min" }, { value: "45", label: "45 min" }, { value: "60", label: "1 hour" }]} />
          <fieldset className="flex flex-col gap-2">
            <legend className={cn("mb-1", fieldLabel)}>Days you take bookings</legend>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => (
                <Button key={d} type="button" size="sm" variant={p.days.includes(i) ? "primary" : "secondary"} aria-pressed={p.days.includes(i)} onClick={() => set({ days: p.days.includes(i) ? p.days.filter((x) => x !== i) : [...p.days, i].sort() })}>{d}</Button>
              ))}
            </div>
            {propError(node, "days") && <p role="alert" className="text-sm font-medium text-danger">{propError(node, "days")}</p>}
          </fieldset>
          <RangeField label="Starts at" value={p.startHour} min={0} max={23} step={1} suffix=":00" onChange={(startHour) => set({ startHour }, "startHour")} />
          <RangeField label="Last call ends at" value={p.endHour} min={1} max={24} step={1} suffix=":00" onChange={(endHour) => set({ endHour }, "endHour")} />
          {propError(node, "endHour") && <p role="alert" className="text-sm font-medium text-danger">{propError(node, "endHour")}</p>}
          <RangeField label="How many days ahead" value={p.daysAhead} min={1} max={60} step={1} onChange={(daysAhead) => set({ daysAhead }, "daysAhead")} />
          <SelectField label="Time zone" value={p.timezone} onChange={(timezone) => set({ timezone })} options={BOOKING_ZONES.map((z) => ({ value: z.id, label: z.label }))} />
          <TextField label="Button label" value={p.buttonLabel} max={40} onChange={(buttonLabel) => set({ buttonLabel }, "buttonLabel")} />
          <TextField label="Message after booking" value={p.successMessage} max={240} multiline onChange={(successMessage) => set({ successMessage }, "successMessage")} />
          <p className="text-xs text-muted-foreground">A time can be booked once. Bookings appear in Sales › Leads.</p>
        </div>
      );
    }
  }
}

function CardsCount({ node }: { node: PageNode }) {
  const n = useEditor((s) => findNode(s.doc.blocks, node.id)?.children.length ?? 0);
  const insert = useEditor((s) => s.insert);
  return (
    <Button type="button" variant="secondary" size="sm" className="self-start" disabled={n >= 12} onClick={() => insert("card", { parentId: node.id, index: n })}>
      <Plus aria-hidden /> Add card ({n} of 12)
    </Button>
  );
}

function ColumnsCount({ node }: { node: PageNode }) {
  const blocks = useEditor((s) => s.doc.blocks);
  const insert = useEditor((s) => s.insert);
  const remove = useEditor((s) => s.remove);
  const n = findNode(blocks, node.id)?.children.length ?? 2;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Columns: {n}</span>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={n >= 4} onClick={() => insert("column", { parentId: node.id, index: n })}>
          <Plus aria-hidden /> Add column
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={n <= 2} onClick={() => remove(node.children[n - 1].id)}>
          <Trash2 aria-hidden /> Remove last
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The settings panel                                                   */
/* ------------------------------------------------------------------ */

type SettingsTab = "content" | "style" | "layout" | "visibility";

const TABS: { id: SettingsTab; label: string; icon: LucideIcon; about: string }[] = [
  { id: "content", label: "Content", icon: Type, about: "What it says, shows and links to." },
  { id: "style", label: "Style", icon: Paintbrush, about: "Colours, background and shape." },
  { id: "layout", label: "Layout", icon: LayoutTemplate, about: "Alignment, size and spacing." },
  { id: "visibility", label: "Visibility", icon: Eye, about: "Which screens it appears on." },
];

/** Kept while the editor is open: the tab last used (it stays open as you move between blocks) and a copied block style */
const memory: { tab: SettingsTab; style?: BlockStyle } = { tab: "content" };
const remember = (p: Partial<typeof memory>) => Object.assign(memory, p);

/** A titled group of settings inside a tab, with an optional reset */
function Group({ title, onReset, children }: { title: string; onReset?: () => void; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="font-sans text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
        {onReset && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground pointer-coarse:min-h-11">
            <RotateCcw className="size-3" aria-hidden /> Reset
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Where the block sits: its parents, each one a button that selects it */
function Trail({ node }: { node: PageNode }) {
  const blocks = useEditor((s) => s.doc.blocks);
  const select = useEditor((s) => s.select);
  const trail: PageNode[] = [];
  let at = locate(blocks, node.id);
  while (at && at.parentId !== "root") {
    const parent = findNode(blocks, at.parentId);
    if (!parent) break;
    trail.unshift(parent);
    at = locate(blocks, parent.id);
  }
  if (!trail.length) return <p className="text-xs text-muted-foreground">Section on this page</p>;
  return (
    <nav aria-label="Inside" className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
      {trail.map((p) => (
        <span key={p.id} className="inline-flex min-w-0 items-center gap-1">
          <button type="button" onClick={() => select(p.id)} className="max-w-28 truncate rounded hover:text-foreground hover:underline pointer-coarse:min-h-11">{nodeLabel(p)}</button>
          <ChevronRight className="size-3 shrink-0" aria-hidden />
        </span>
      ))}
      <span className="truncate font-medium text-foreground">{BLOCK_LABELS[node.type]}</span>
    </nav>
  );
}

/** The selected block's name, where it sits, and quick actions */
function BlockHeader({ node }: { node: PageNode }) {
  const moveBy = useEditor((s) => s.moveBy);
  const duplicate = useEditor((s) => s.duplicate);
  const remove = useEditor((s) => s.remove);
  const select = useEditor((s) => s.select);
  const Icon = BLOCK_ICONS[node.type];
  const fixed = node.type === "column";
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-control bg-primary-soft text-primary" aria-hidden><Icon className="size-4" /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm leading-tight font-semibold">{nodeLabel(node)}</p>
        <Trail node={node} />
      </div>
      {!fixed && (
        <div role="group" aria-label="Block actions" className="flex shrink-0 items-center">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveBy(node.id, -1)} aria-label="Move up" title="Move up"><ArrowUp /></Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveBy(node.id, 1)} aria-label="Move down" title="Move down"><ArrowDown /></Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => { const id = duplicate(node.id); if (id) select(id); }} aria-label="Duplicate" title="Duplicate"><Copy /></Button>
          <Button type="button" variant="ghost" size="icon-sm" className="text-danger hover:text-danger" onClick={() => remove(node.id)} aria-label="Delete" title="Delete (Del)"><Trash2 /></Button>
        </div>
      )}
    </div>
  );
}

/** One screen size a block can be shown or hidden on */
function ScreenToggle({ icon: Icon, label, on, onChange }: { icon: LucideIcon; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-control border p-3 transition-colors", on ? "bg-surface" : "border-dashed bg-surface-sunken")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-control", on ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")} aria-hidden><Icon className="size-4" /></span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[0.8125rem] font-medium">{label}</span>
      </div>
      <span className={cn("text-xs font-medium", on ? "text-success" : "text-muted-foreground")}>{on ? "Shown" : "Hidden"}</span>
      <Switch checked={on} onCheckedChange={onChange} aria-label={`Show on ${label.toLowerCase()}`} />
    </div>
  );
}

const DEFAULT_LAYOUT = layoutSchema.parse({});
const ALIGN: { value: "left" | "center" | "right"; label: string }[] = [{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }];
const sameStyle = (a: Partial<BlockStyle>, b: Partial<BlockStyle>) => JSON.stringify(a) === JSON.stringify(b);

/** Settings for the selected block, in four tabs. Every change shows on the canvas straight away. */
export function SettingsPanel({ context, mode = "light" }: { context: RenderContext; /** Which side of each scheme the swatches show */ mode?: "light" | "dark" }) {
  const selectedId = useEditor((s) => s.selectedId);
  const node = useEditor((s) => (s.selectedId ? findNode(s.doc.blocks, s.selectedId) : undefined));
  const updateProps = useEditor((s) => s.updateProps);
  const updateStyle = useEditor((s) => s.updateStyle);
  const updateLayout = useEditor((s) => s.updateLayout);
  const updateVisibility = useEditor((s) => s.updateVisibility);
  const updatePageStyle = useEditor((s) => s.updatePageStyle);
  const blocks = useEditor((s) => s.doc.blocks);
  const select = useEditor((s) => s.select);
  const pageStyle = useEditor((s) => s.doc.style);
  const focus = useEditor((s) => !!s.doc.focus);
  const setFocus = useEditor((s) => s.setFocus);
  const theme = useEditor((s) => s.site?.design.theme) ?? context.theme;
  const [tab, setTabState] = useState<SettingsTab>(memory.tab);
  const setTab = (t: SettingsTab) => {
    remember({ tab: t });
    setTabState(t);
  };
  const [copied, setCopied] = useState(!!memory.style);

  if (isSitePart(selectedId)) return <SitePartPanel part={selectedId} context={context} mode={mode} />;

  if (!selectedId || !node) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-control border border-dashed p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><MousePointer2 className="size-4 text-primary" aria-hidden /> Nothing selected</p>
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <li><span className="font-medium text-foreground">Click</span> any block on the page, or in the Sections list, to change it.</li>
            <li><span className="font-medium text-foreground">Type</span> straight into text on the page.</li>
            <li><span className="font-medium text-foreground">Preview</span> (top bar) opens your draft in a new tab.</li>
          </ul>
        </div>
        <Group title="Page colours">
          <SchemeField label="Colour scheme for the whole page" value={pageStyle?.scheme ?? ""} onChange={(scheme) => updatePageStyle({ scheme })} theme={theme} mode={mode} noneLabel="Store default" />
        </Group>
        <Group title="Focus mode">
          <SwitchField label="Hide the store menu and footer" checked={focus} onChange={setFocus} hint="For squeeze pages and ads: visitors see only this page, with one thing to do." />
        </Group>
        <Group title="Page background">
          <p className="-mt-1 text-xs text-muted-foreground">Behind every section. Sections with their own background sit on top.</p>
          <BackgroundPicker style={pageStyle ?? DEFAULT_STYLE} context={context} onChange={(patch, key) => updatePageStyle(patch, key)} />
        </Group>
      </div>
    );
  }

  const container = node.type === "section" || node.type === "hero";
  const holder = CONTAINERS.has(node.type);
  const styleKeys = ["scheme", "background", "overlay", "overlayColor", "tone", "radius", "border", "shadow"] as const;
  const pick = (s: BlockStyle) => Object.fromEntries(styleKeys.map((k) => [k, s[k]])) as Partial<BlockStyle>;
  const styled = !sameStyle(pick(styleSchema.parse(node.style)), pick(DEFAULT_STYLE));
  const laidOut = JSON.stringify(layoutSchema.parse(node.layout)) !== JSON.stringify(DEFAULT_LAYOUT) || node.style.align !== DEFAULT_STYLE.align || (node.style.selfAlign ?? "") !== "";
  const hidden = !node.visibility.mobile || !node.visibility.desktop;
  const marks: Partial<Record<SettingsTab, boolean>> = { style: styled, layout: laidOut, visibility: hidden };
  const about = TABS.find((t) => t.id === tab)!.about;

  return (
    <div className="flex flex-col gap-3">
      <BlockHeader node={node} />
      {/* Tabs as an even strip: icon over a short word, a dot where something was changed */}
      <div role="tablist" aria-label="Block settings" className="grid grid-cols-4 gap-0.5 rounded-control bg-muted p-0.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`st-${id}`}
            aria-selected={tab === id}
            aria-controls="st-panel"
            onClick={() => setTab(id)}
            className={cn(
              "relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[7px] border border-transparent px-1 text-[0.6875rem] font-medium transition-colors",
              tab === id ? "border-border bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {marks[id] && <span className="absolute top-1 right-1.5 size-1.5 rounded-full bg-primary" aria-label="(changed)" />}
          </button>
        ))}
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{about}</p>

      <div id="st-panel" role="tabpanel" aria-labelledby={`st-${tab}`} key={`${node.id}:${tab}`} className="flex flex-col gap-4">
        {tab === "content" && <ContentForm node={node} context={context} set={(patch, key) => updateProps(node.id, patch, key)} />}

        {tab === "style" && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => { remember({ style: node.style }); setCopied(true); toast.success("Style copied", { description: "Select another block and paste it." }); }}>
                <ClipboardCopy aria-hidden /> Copy style
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={!copied} onClick={() => memory.style && updateStyle(node.id, pick(memory.style))}>
                <ClipboardPaste aria-hidden /> Paste style
              </Button>
            </div>
            <Group title="Colours" onReset={node.style.scheme ? () => updateStyle(node.id, { scheme: "" }) : undefined}>
              <SchemeField value={node.style.scheme ?? ""} onChange={(scheme) => updateStyle(node.id, { scheme })} theme={theme} mode={mode} />
              <p className="-mt-1 text-xs text-muted-foreground">{container ? "The section follows the store theme unless you pick one. Blocks inside keep their own colours." : "Empty follows the section around it. Anything you pick styles only this block."}</p>
            </Group>
            {container && (
              <Group title="Background" onReset={node.style.background.kind !== "none" ? () => updateStyle(node.id, { background: DEFAULT_STYLE.background, overlay: 0, tone: "auto" }) : undefined}>
                <BackgroundPicker style={node.style} context={context} onChange={(patch, key) => updateStyle(node.id, patch, key)} />
                <ChoiceField label="Background covers" value={node.layout.fill ?? "full"} onChange={(fill) => updateLayout(node.id, { fill })} options={[{ value: "full", label: "Whole width" }, { value: "content", label: "Content area" }]} />
              </Group>
            )}
            <Group title="Shape" onReset={node.style.radius !== "none" || node.style.border || node.style.shadow !== "none" ? () => updateStyle(node.id, { radius: "none", border: false, shadow: "none" }) : undefined}>
              <ChoiceField label="Corners" value={node.style.radius} onChange={(radius) => updateStyle(node.id, { radius })} options={[{ value: "none", label: "Default" }, { value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }]} />
              <ChoiceField label="Shadow" value={node.style.shadow} onChange={(shadow) => updateStyle(node.id, { shadow })} options={[{ value: "none", label: "None" }, { value: "soft", label: "Soft" }]} />
              <SwitchField label="Border" checked={node.style.border} onChange={(border) => updateStyle(node.id, { border })} />
            </Group>
          </>
        )}

        {tab === "layout" && (
          <>
            <Group title="Alignment">
              {holder ? (
                <ChoiceField label={node.type === "card" ? "Align the words" : "Align what's inside"} value={node.style.align} onChange={(align) => updateStyle(node.id, { align })} options={ALIGN} />
              ) : (
                <ChoiceField label="Align" value={node.style.selfAlign ?? ""} onChange={(selfAlign) => updateStyle(node.id, { selfAlign })} options={[{ value: "", label: "Auto" }, ...ALIGN]} />
              )}
              {container && node.layout.minHeight !== "auto" && (
                <ChoiceField label="Line up vertically" value={node.layout.valign ?? "center"} onChange={(valign) => updateLayout(node.id, { valign })} options={[{ value: "start", label: "Top" }, { value: "center", label: "Middle" }, { value: "end", label: "Bottom" }]} />
              )}
            </Group>
            {container && (
              <Group title="Size" onReset={node.layout.width !== "normal" || node.layout.minHeight !== "auto" ? () => updateLayout(node.id, { width: "normal", minHeight: "auto" }) : undefined}>
                <ChoiceField label="Width" value={node.layout.width} onChange={(width) => updateLayout(node.id, { width })} options={[{ value: "narrow", label: "Narrow" }, { value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }, { value: "full", label: "Full" }]} />
                <ChoiceField label="Height" value={node.layout.minHeight} onChange={(minHeight) => updateLayout(node.id, { minHeight })} options={[{ value: "auto", label: "Fit" }, { value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }, { value: "screen", label: "Screen" }]} />
              </Group>
            )}
            {(container || node.type === "column" || node.type === "columns") && (
              <Group title="Spacing" onReset={node.layout.paddingY !== "md" || node.layout.gap !== "md" ? () => updateLayout(node.id, { paddingY: "md", gap: "md" }) : undefined}>
                {container && <ChoiceField label="Space above and below" value={node.layout.paddingY} onChange={(paddingY) => updateLayout(node.id, { paddingY })} options={[{ value: "none", label: "0" }, { value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }, { value: "xl", label: "XL" }]} />}
                <ChoiceField label="Gap between blocks" value={node.layout.gap} onChange={(gap) => updateLayout(node.id, { gap })} options={[{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }]} />
              </Group>
            )}
            {!container && node.type !== "column" && node.type !== "columns" && <p className="text-xs text-muted-foreground">Width, height and spacing belong to the section this block sits in. <button type="button" className="font-medium text-primary underline underline-offset-4" onClick={() => { const s = sectionOf(blocks, node.id); if (s) select(s.id); }}>Select the section</button></p>}
          </>
        )}

        {tab === "visibility" && (
          <>
            <ScreenToggle icon={Monitor} label="Desktop and tablet" on={node.visibility.desktop} onChange={(desktop) => updateVisibility(node.id, { desktop })} />
            <ScreenToggle icon={Smartphone} label="Phones" on={node.visibility.mobile} onChange={(mobile) => updateVisibility(node.id, { mobile })} />
            {!node.visibility.mobile && !node.visibility.desktop ? (
              <p role="status" className="rounded-control bg-warning-soft px-3 py-2 text-xs text-warning-ink">Hidden everywhere. Buyers won&apos;t see this block; it stays here for you to bring back.</p>
            ) : hidden ? (
              <p className="text-xs text-muted-foreground">Handy for a shorter phone version: hide a big block on phones and add a smaller one shown only there.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Shown on every screen.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
