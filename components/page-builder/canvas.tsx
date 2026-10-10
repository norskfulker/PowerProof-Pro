"use client";

import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, CornerLeftUp, Eye, EyeOff, Plus, SquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AnnouncementBar } from "@/components/pp/announcement-bar";
import { StoreFooter } from "@/components/pp/store-footer";
import { StoreNavbar } from "@/components/pp/store-navbar";
import { StoreThemeScope } from "@/components/pp/store-theme";
import type { RenderContext } from "@/lib/api";
import { BLOCK_LABELS, type SiteDraft } from "@/lib/pages/editor-store";
import { CHILDREN, findNode, locate, sectionOf, type PageDoc } from "@/lib/pages/schema";
import { schemeClass } from "@/lib/store-themes";
import { layoutOf } from "@/lib/site-styles";
import { cn } from "@/lib/utils";
import type { IconWeight } from "@/components/pp/icon-library";
import { IconPickerDialog } from "./controls";
import { DeviceFrame, SCREEN_HEIGHT, SCREEN_WIDTH } from "./device-frame";
import { useEditor } from "./editor-context";
import { PreviewFrame, useFrameDocument } from "./preview-frame";
import { PageRenderer } from "./renderer";

/** The parts of every page that belong to the whole store, selected as "@<part>" */
export const SITE_PARTS = { "@announcement": "Announcement bar", "@header": "Header", "@footer": "Footer" } as const;
export type SitePart = keyof typeof SITE_PARTS;
export const isSitePart = (id?: string): id is SitePart => !!id && id in SITE_PARTS;

/** Set a value at a dotted path inside a block's props ("rows.1.2", "items.0.text"), copying as it goes */
export function setAtPath(props: Record<string, unknown>, path: string, value: string): Record<string, unknown> {
  const parts = path.split(".");
  if (parts.some((p) => p === "__proto__" || p === "constructor" || p === "prototype")) return props;
  const next = setIn(props, parts, value);
  return next === undefined ? props : (next as Record<string, unknown>);
}

/** The copy with the value set, or undefined when the path leads nowhere */
function setIn(node: unknown, parts: string[], value: string): unknown {
  const [head, ...rest] = parts;
  if (Array.isArray(node)) {
    const i = Number(head);
    if (!Number.isInteger(i) || i < 0 || i >= node.length) return undefined;
    const child = rest.length ? setIn(node[i], rest, value) : value;
    if (child === undefined) return undefined;
    const copy = [...node];
    copy[i] = child;
    return copy;
  }
  if (node && typeof node === "object") {
    const child = rest.length ? setIn((node as Record<string, unknown>)[head], rest, value) : value;
    return child === undefined ? undefined : { ...node, [head]: child };
  }
  return undefined;
}

/** Small toolbar pinned to the selected block: parent, up, down, add, duplicate, hide, delete. */
export function BlockToolbar({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  const selectedId = useEditor((s) => s.selectedId);
  const rev = useEditor((s) => s.rev);
  const device = useEditor((s) => s.device);
  const blocks = useEditor((s) => s.doc.blocks);
  const { select, moveBy, duplicate, remove, updateVisibility, updateStyle, setAdding, insert } = useEditor((s) => s);
  const [pos, setPos] = useState<{ top: number; left: number; max: number } | null>(null);

  useEffect(() => {
    const box = container.current;
    if (!box || !selectedId || isSitePart(selectedId)) {
      const id = requestAnimationFrame(() => setPos(null));
      return () => cancelAnimationFrame(id);
    }
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = box.querySelector<HTMLElement>(`[data-node-id="${selectedId}"]`);
        if (!el) return setPos(null);
        const a = el.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        const above = a.top - b.top + box.scrollTop - 48;
        setPos({ top: above < box.scrollTop + 4 ? a.top - b.top + box.scrollTop + 8 : above, left: Math.max(4, Math.min(a.left - b.left + 8, b.width - 420)), max: b.width - 8 });
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    box.addEventListener("scroll", measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      box.removeEventListener("scroll", measure);
    };
  }, [container, selectedId, rev, device]);

  const node = selectedId ? findNode(blocks, selectedId) : undefined;
  if (!node || !pos) return null;
  const at = locate(blocks, node.id)!;
  const siblings = at.parentId === "root" ? blocks.length : findNode(blocks, at.parentId)?.children.length ?? 0;
  const label = BLOCK_LABELS[node.type];
  const top = at.parentId === "root";
  const hidden = !node.visibility.mobile && !node.visibility.desktop;
  const holder = ["section", "hero", "columns", "column", "cards", "card"].includes(node.type);
  const align = holder ? node.style.align : node.style.selfAlign || "";
  const setAlign = (a: "left" | "center" | "right") => (holder ? updateStyle(node.id, { align: a }) : updateStyle(node.id, { selfAlign: align === a ? "" : a }));
  const holds = CHILDREN[node.type] ?? [];
  const addInside = node.type === "cards" ? () => insert("card", { parentId: node.id, index: node.children.length }) : holds.length && node.type !== "columns" ? () => setAdding({ kind: "block", parentId: node.id }) : undefined;
  return (
    <div role="toolbar" aria-label={`${label} actions`} data-pp-ui="" className="absolute z-40 flex items-center gap-0.5 overflow-x-auto rounded-full bg-foreground p-1 text-background shadow-lg [scrollbar-width:none]" style={{ top: pos.top, left: pos.left, maxWidth: pos.max }}>
      <span className="px-2.5 text-xs font-semibold whitespace-nowrap">{label}</span>
      {[
        { label: "Select the block around this one", icon: CornerLeftUp, disabled: top, run: () => select(at.parentId) },
        { label: `Move ${label} up`, icon: ArrowUp, disabled: at.index === 0, run: () => moveBy(node.id, -1) },
        { label: `Move ${label} down`, icon: ArrowDown, disabled: at.index >= siblings - 1, run: () => moveBy(node.id, 1) },
        ...(addInside ? [{ label: node.type === "cards" ? "Add a card" : "Add a block inside", icon: SquarePlus, disabled: false, run: addInside }] : []),
        ...(top ? [{ label: "Add a section below", icon: Plus, disabled: false, run: () => setAdding({ kind: "section", index: at.index + 1 }) }] : []),
        { label: `Duplicate ${label}`, icon: Copy, disabled: false, run: () => (duplicate(node.id) ? undefined : toast.error("Can't duplicate here: that's the limit for this spot.")) },
        { label: hidden ? `Show ${label}` : `Hide ${label}`, icon: hidden ? EyeOff : Eye, disabled: false, run: () => updateVisibility(node.id, { mobile: hidden, desktop: hidden }) },
        { label: `Delete ${label}`, icon: Trash2, disabled: false, run: () => remove(node.id) },
      ].map((b) => (
        <button key={b.label} type="button" aria-label={b.label} title={b.label} disabled={b.disabled} onClick={b.run} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-background/20 disabled:opacity-30">
          <b.icon className="size-4" aria-hidden />
        </button>
      ))}
      <span aria-hidden className="mx-0.5 h-5 w-px bg-background/25" />
      {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => (
        <button key={a} type="button" aria-label={`Align ${a}`} title={`Align ${a}`} aria-pressed={align === a} onClick={() => setAlign(a)} className={cn("grid size-8 shrink-0 place-items-center rounded-full hover:bg-background/20", align === a && "bg-background/25")}>
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** A thin "Add section" line between two sections, shown on hover */
function AddLine({ index }: { index: number }) {
  const setAdding = useEditor((s) => s.setAdding);
  return (
    <div data-pp-ui="" className="group/add relative z-30 h-0">
      <div className="absolute inset-x-0 -top-3 flex h-6 items-center justify-center opacity-0 transition-opacity group-hover/add:opacity-100 focus-within:opacity-100">
        <span aria-hidden className="absolute inset-x-6 top-1/2 h-px bg-primary" />
        <button type="button" onClick={() => setAdding({ kind: "section", index })} className="relative inline-flex h-6 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow">
          <Plus className="size-3.5" aria-hidden /> Add section
        </button>
      </div>
    </div>
  );
}

/** Store-wide parts (announcement, header, footer): click to select, links don't navigate */
function SitePartFrame({ id, children, className }: { id: SitePart; children: React.ReactNode; className?: string }) {
  const selected = useEditor((s) => s.selectedId === id);
  const select = useEditor((s) => s.select);
  const setLinkPrompt = useEditor((s) => s.setLinkPrompt);
  return (
    <div
      data-node-id={id}
      className={cn("relative cursor-pointer outline-offset-[-2px] hover:outline hover:outline-1 hover:outline-primary/50", selected && "outline outline-2 outline-primary hover:outline-2", className)}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        select(id);
        // A menu or footer link: offer to go and edit the page or section it leads to
        const link = (e.target as Element).closest?.("a[href]");
        if (link) setLinkPrompt({ href: link.getAttribute("href") ?? "", label: (link.textContent ?? "").trim() || "this link" });
      }}
      // The header's search box and menu are shown, not used: nothing inside can take focus or submit
      onMouseDownCapture={(e) => e.preventDefault()}
      onSubmitCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}

/** The icon picker for an icon clicked on the page; the pick applies at once */
export function CanvasIconPicker() {
  const pick = useEditor((s) => s.iconPick);
  const node = useEditor((s) => (s.iconPick ? findNode(s.doc.blocks, s.iconPick.id) : undefined));
  const { setIconPick, updateProps } = useEditor((s) => s);
  const weight = (node?.props as { iconWeight?: IconWeight } | undefined)?.iconWeight;
  return (
    <IconPickerDialog
      open={!!pick && !!node}
      value={pick?.current ?? ""}
      weight={weight}
      onClose={() => setIconPick(undefined)}
      onPick={(name) => {
        if (pick && node) updateProps(node.id, setAtPath(node.props as Record<string, unknown>, pick.path, name));
      }}
    />
  );
}

/** Forwards key presses inside the frame to the editor's shortcuts */
function FrameKeys({ onKey }: { onKey?: (e: KeyboardEvent) => void }) {
  const doc = useFrameDocument();
  useEffect(() => {
    if (!doc || !onKey) return;
    doc.addEventListener("keydown", onKey);
    return () => doc.removeEventListener("keydown", onKey);
  }, [doc, onKey]);
  return null;
}

function Page({ context, site, doc, previewAs, interactive, onKey, screen }: { context: RenderContext; site?: SiteDraft; doc: PageDoc; previewAs?: "light" | "dark"; interactive: boolean; onKey?: (e: KeyboardEvent) => void; /** What a "full screen" section fills, in px */ screen: number }) {
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const updateProps = useEditor((s) => s.updateProps);
  const setIconPick = useEditor((s) => s.setIconPick);
  const box = useRef<HTMLDivElement>(null);
  const design = site?.design;
  const theme = design?.theme ?? context.theme;
  const store = { ...context.store, ...(site ? { logo: site.logo } : {}) };
  const announcementOn = !!design?.sections.find((s) => s.id === "announcement")?.enabled;
  const chrome = !!design && !doc.focus;
  // Whatever is selected (from the sidebar, the picker or the page) comes into view. The frame is
  // as tall as the page, so it's the editor's window that scrolls.
  useEffect(() => {
    const el = selectedId && interactive ? box.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(selectedId)}"]`) : null;
    const frame = el?.ownerDocument.defaultView?.frameElement as HTMLElement | null | undefined;
    if (!el || !frame) return;
    const top = frame.getBoundingClientRect().top + el.getBoundingClientRect().top;
    const height = el.getBoundingClientRect().height;
    // The app bar and the editor's own bar sit over the top of the window
    const covered = (document.querySelector<HTMLElement>("[data-editor-bar]")?.getBoundingClientRect().bottom ?? 64) + 12;
    const view = window.innerHeight - covered;
    if (top < covered || top + Math.min(height, view) > window.innerHeight - 24) {
      window.scrollTo({ top: window.scrollY + top - covered - (height > view - 80 ? 24 : (view - height) / 2), behavior: "smooth" });
    }
  }, [selectedId, interactive]);
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  });
  const env = {
    mode: "edit" as const,
    currency: context.store.currency,
    selectedId: interactive ? selectedId : undefined,
    onSelect: interactive ? select : undefined,
    onText: interactive ? (id: string, path: string, value: string) => {
      const node = findNode(docRef.current.blocks, id);
      if (node) updateProps(id, setAtPath(node.props as Record<string, unknown>, path, value), `text:${path}`);
    } : undefined,
    between: interactive ? (i: number) => <AddLine index={i} /> : undefined,
    onIcon: interactive ? (id: string, path: string, current: string) => setIconPick({ id, path, current }) : undefined,
  };

  return (
    <StoreThemeScope theme={theme} mode={previewAs} className="flex flex-1 flex-col" style={{ ["--pp-screen" as string]: `${screen}px` }}>
      <FrameKeys onKey={onKey} />
      <div ref={box} className="relative flex flex-1 flex-col" onClick={(e) => e.target === e.currentTarget && select(undefined)}>
        {chrome && announcementOn && (
          <SitePartFrame id="@announcement">
            <AnnouncementBar announcement={design.announcement} editing />
          </SitePartFrame>
        )}
        {chrome && (
          <SitePartFrame id="@header" className={cn("sticky top-0 z-30", schemeClass(design.header?.scheme))}>
            <StoreNavbar store={store} collections={context.collections} header={{ ...design.header, sticky: false }} />
          </SitePartFrame>
        )}
        {/* The draft theme, so colours on the page follow unpublished changes */}
        <PageRenderer doc={doc} context={{ ...context, theme }} env={env} className="flex-1" />
        {chrome && (
          <SitePartFrame id="@footer" className={schemeClass(design.footer?.scheme)}>
            <StoreFooter store={store} socials={design.socials} showPoweredBy={design.showPoweredBy} layout={layoutOf(theme).footer} />
          </SitePartFrame>
        )}
        {interactive && <BlockToolbar container={box} />}
      </div>
    </StoreThemeScope>
  );
}

/**
 * The live page in a frame sized to the device switch, with the store's announcement bar, header
 * and footer around it exactly as buyers see them. "This section" isolates the selected section;
 * before/after puts the live page beside the draft.
 */
export function Canvas({ context, published, className, previewAs, onKey, address = "" }: { context: RenderContext; published?: PageDoc; className?: string; previewAs?: "light" | "dark"; onKey?: (e: KeyboardEvent) => void; /** Shown in the desktop window's address bar */ address?: string }) {
  const doc = useEditor((s) => s.doc);
  const site = useEditor((s) => s.site);
  const selectedId = useEditor((s) => s.selectedId);
  const device = useEditor((s) => s.device);
  const focusSection = useEditor((s) => s.focusSection);
  const compare = useEditor((s) => s.compare);
  // An AI build is shown but can't be changed until it is kept
  const building = useEditor((s) => !!s.aiBase);

  const section = selectedId && !isSitePart(selectedId) ? sectionOf(doc.blocks, selectedId) : undefined;
  const shown: PageDoc = focusSection && section ? { ...doc, blocks: [section], focus: true } : doc;
  const screen = device === "desktop" ? Math.max(560, Math.min(SCREEN_HEIGHT.desktop, typeof window === "undefined" ? 720 : window.innerHeight - 200)) : SCREEN_HEIGHT[device];

  const frame = (d: PageDoc, label: string, interactive: boolean) => (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {compare && <p className="eyebrow text-center">{label}</p>}
      <DeviceFrame device={device} address={address} dark={previewAs === "dark"}>
        <PreviewFrame title={interactive ? "Page editor canvas" : "Live page"} className="block w-full border-0 bg-background" style={{ maxWidth: SCREEN_WIDTH[device] }} minHeight={device === "desktop" ? 480 : screen - 76}>
          <Page context={context} site={site} doc={d} previewAs={previewAs} interactive={interactive} onKey={interactive ? onKey : undefined} screen={screen} />
        </PreviewFrame>
      </DeviceFrame>
    </div>
  );

  return (
    <div className={cn("relative flex flex-col bg-surface-sunken p-3 md:p-6", className)} aria-label="Page canvas" role="region">
      {focusSection && !section && <p className="mb-3 text-center text-sm text-muted-foreground">Select a block to see its section on its own.</p>}
      {compare ? (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          {published ? frame(published, "Live now", false) : <p className="flex-1 rounded-card border border-dashed p-8 text-center text-sm text-muted-foreground">Not published yet.</p>}
          {frame(shown, "Your draft", true)}
        </div>
      ) : (
        frame(shown, "Your draft", !building)
      )}
    </div>
  );
}
