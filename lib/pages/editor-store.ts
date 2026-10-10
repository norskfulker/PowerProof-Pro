import { createStore } from "zustand/vanilla";
import {
  CHILDREN,
  CONTENT_TYPES,
  cloneNode,
  findNode,
  locate,
  makeNode,
  parentType,
  sectionOf,
  styleSchema,
  type BlockLayout,
  type BlockStyle,
  type BlockType,
  type PageDoc,
  type PageNode,
  type StorePageDoc,
} from "./schema";

/** The store-wide look (theme, schemes, header, announcement, footer) and logo, edited beside the page */
export type SiteDraft = NonNullable<StorePageDoc["site"]>;

interface Snapshot {
  doc: PageDoc;
  site?: SiteDraft;
}

/**
 * Editor state for one page (Part 4C). Every change goes through `commit`, which records the
 * previous document for undo. Typing in one field coalesces into a single undo step.
 * `moveNode(id, parentId, index)` is the one move primitive, ready for drag and drop later.
 */

export type Device = "mobile" | "tablet" | "desktop";

export const EDITOR_PANELS = ["sections", "pages", "theme", "content", "reviews", "questions", "edit"] as const;
export type EditorPanel = (typeof EDITOR_PANELS)[number];

export interface EditorState {
  doc: PageDoc;
  /** Store-wide settings; undefined where the editor doesn't edit them */
  site?: SiteDraft;
  selectedId?: string;
  past: Snapshot[];
  future: Snapshot[];
  /** Bumped on every edit; autosave compares it to `savedRev` */
  rev: number;
  savedRev: number;
  device: Device;
  /** Show only the section that holds the selection */
  focusSection: boolean;
  /** Before/after: show the published page next to the draft */
  compare: boolean;
  lastKey?: { key: string; at: number };
  /** The "Add" picker: a section at a position on the page, or a block inside a section */
  adding?: { kind: "section"; index: number } | { kind: "block"; parentId: string };
  setAdding: (a: EditorState["adding"]) => void;
  /** The icon picker, opened by clicking an icon on the page */
  iconPick?: { id: string; path: string; current: string };
  setIconPick: (p: EditorState["iconPick"]) => void;
  /**
   * An AI build in progress: the page and site as they were before it, so it can be kept (one undo
   * step) or thrown away. While set, the canvas shows the build and nothing is autosaved.
   */
  aiBase?: Snapshot;
  /** Start showing an AI build (remembers the page as it is) */
  beginAi: () => void;
  /** Show the build so far, outside undo history */
  showAi: (doc: PageDoc, site?: SiteDraft) => void;
  /** Keep the build as one undo step, or go back to the page as it was */
  endAi: (keep: boolean) => void;
  /** A link clicked in the header or footer: offer to go and edit where it leads */
  linkPrompt?: { href: string; label: string };
  setLinkPrompt: (p: EditorState["linkPrompt"]) => void;
  /** The editor's side panel: the page's sections, the store's pages, theme, About and FAQ, reviews, questions */
  panel: EditorPanel;
  /** Opens a panel; `at` scrolls to a part of it (like "faq") */
  openPanel: (panel: EditorPanel, at?: string) => void;
  panelAt?: string;

  select: (id?: string) => void;
  setDevice: (d: Device) => void;
  setFocusSection: (v: boolean) => void;
  setCompare: (v: boolean) => void;
  undo: () => void;
  redo: () => void;
  /** Replace the whole document (load, discard, restore). Clears history. */
  reset: (doc: PageDoc, site?: SiteDraft) => void;
  /** Change the store-wide settings (undoable) */
  updateSite: (fn: (s: SiteDraft) => SiteDraft, coalesceKey?: string) => void;
  /** Change the store-wide settings and re-lay this page out with them, as one undo step */
  restyle: (fn: (s: SiteDraft) => SiteDraft, docFn: (d: PageDoc) => PageDoc) => void;
  /** Put a ready-made section (from SECTION_PRESETS) at the top level */
  insertSection: (section: PageNode, index?: number) => string | undefined;
  markSaved: (rev: number) => void;

  insert: (type: BlockType, opts?: { parentId?: string; index?: number }) => string | undefined;
  remove: (id: string) => void;
  duplicate: (id: string) => string | undefined;
  moveNode: (id: string, parentId: string, index: number) => boolean;
  moveBy: (id: string, delta: -1 | 1) => boolean;
  updateProps: (id: string, patch: Record<string, unknown>, coalesceKey?: string) => void;
  updateStyle: (id: string, patch: Partial<BlockStyle>, coalesceKey?: string) => void;
  updateLayout: (id: string, patch: Partial<BlockLayout>) => void;
  updateVisibility: (id: string, patch: Partial<PageNode["visibility"]>) => void;
  /** The page-level background */
  updatePageStyle: (patch: Partial<BlockStyle>, coalesceKey?: string) => void;
  /** Focus mode: hide the store menu and footer on this page */
  setFocus: (focus: boolean) => void;
}

const HISTORY = 100;
const COALESCE_MS = 1000;

/* ------------------------------------------------------------------ */
/* Immutable tree operations                                            */
/* ------------------------------------------------------------------ */

function mapNode(blocks: PageNode[], id: string, fn: (n: PageNode) => PageNode): PageNode[] {
  return blocks.map((b) => (b.id === id ? fn(b) : b.children.length ? { ...b, children: mapNode(b.children, id, fn) } : b));
}

function withChildren(blocks: PageNode[], parentId: string, fn: (kids: PageNode[]) => PageNode[]): PageNode[] {
  if (parentId === "root") return fn(blocks);
  return mapNode(blocks, parentId, (p) => ({ ...p, children: fn(p.children) }));
}

function removeNode(blocks: PageNode[], id: string): PageNode[] {
  return blocks.filter((b) => b.id !== id).map((b) => (b.children.length ? { ...b, children: removeNode(b.children, id) } : b));
}

/** Can a node of `type` live under `parentId` in this document? */
export function canHold(blocks: PageNode[], parentId: string, type: BlockType): boolean {
  const pt = parentType(blocks, parentId);
  return !!pt && CHILDREN[pt].includes(type);
}

/** Where a new block of `type` should go, given what's selected. */
export function insertionPoint(blocks: PageNode[], type: BlockType, selectedId?: string): { parentId: string; index: number; wrap: boolean } {
  const topLevel = CHILDREN.root.includes(type);
  if (!selectedId || !findNode(blocks, selectedId)) {
    return { parentId: "root", index: blocks.length, wrap: !topLevel };
  }
  if (topLevel) {
    const sec = sectionOf(blocks, selectedId)!;
    return { parentId: "root", index: blocks.indexOf(sec) + 1, wrap: false };
  }
  const sel = findNode(blocks, selectedId)!;
  // Selected a container that can take it: append inside
  if (CHILDREN[sel.type].includes(type)) return { parentId: sel.id, index: sel.children.length, wrap: false };
  // Selected a card: another card goes after it
  if (sel.type === "card" && type === "card") {
    const at = locate(blocks, selectedId)!;
    return { parentId: at.parentId, index: at.index + 1, wrap: false };
  }
  // Selected columns: put it in the first column
  if (sel.type === "columns" && sel.children[0]) return { parentId: sel.children[0].id, index: sel.children[0].children.length, wrap: false };
  // Otherwise right after the selection, if its parent allows it
  const at = locate(blocks, selectedId)!;
  if (canHold(blocks, at.parentId, type)) return { parentId: at.parentId, index: at.index + 1, wrap: false };
  // Fall back to a new section after the selected one
  const sec = sectionOf(blocks, selectedId)!;
  return { parentId: "root", index: blocks.indexOf(sec) + 1, wrap: true };
}

/* ------------------------------------------------------------------ */
/* Store                                                                */
/* ------------------------------------------------------------------ */

export function createEditorStore(initial: PageDoc, initialSite?: SiteDraft) {
  return createStore<EditorState>((set, get) => {
    const snap = (): Snapshot => ({ doc: get().doc, site: get().site });
    /** Apply a change to the document, recording undo history. */
    const commit = (next: PageDoc, coalesceKey?: string, selectedId?: string, site = get().site) => {
      const s = get();
      const now = Date.now();
      const coalesce = !!coalesceKey && s.lastKey?.key === coalesceKey && now - s.lastKey.at < COALESCE_MS;
      set({
        doc: next,
        site,
        past: coalesce ? s.past : [...s.past, snap()].slice(-HISTORY),
        future: [],
        rev: s.rev + 1,
        lastKey: coalesceKey ? { key: coalesceKey, at: now } : undefined,
        ...(selectedId !== undefined ? { selectedId } : {}),
      });
    };
    const blocks = () => get().doc.blocks;
    const docWith = (b: PageNode[]): PageDoc => ({ ...get().doc, blocks: b });

    return {
      doc: initial,
      site: initialSite,
      selectedId: undefined,
      past: [],
      future: [],
      rev: 0,
      savedRev: 0,
      device: "desktop",
      focusSection: false,
      compare: false,

      select: (id) => set({ selectedId: id, lastKey: undefined }),
      setDevice: (device) => set({ device }),
      setFocusSection: (focusSection) => set({ focusSection }),
      setCompare: (compare) => set({ compare }),
      setAdding: (adding) => set({ adding }),
      setIconPick: (iconPick) => set({ iconPick }),
      setLinkPrompt: (linkPrompt) => set({ linkPrompt }),
      panel: "sections",
      openPanel: (panel, panelAt) => set({ panel, panelAt }),
      beginAi: () => set({ aiBase: snap(), selectedId: undefined, lastKey: undefined }),
      showAi: (doc, site) => {
        if (!get().aiBase) return;
        set({ doc, ...(site ? { site } : {}) });
      },
      endAi: (keep) => {
        const s = get();
        const base = s.aiBase;
        if (!base) return;
        if (keep) set({ aiBase: undefined, past: [...s.past, base].slice(-HISTORY), future: [], rev: s.rev + 1, lastKey: undefined });
        else set({ aiBase: undefined, doc: base.doc, site: base.site, selectedId: undefined });
      },

      undo: () => {
        const s = get();
        const prev = s.past.at(-1);
        if (!prev) return;
        set({ doc: prev.doc, site: prev.site, past: s.past.slice(0, -1), future: [snap(), ...s.future], rev: s.rev + 1, lastKey: undefined, selectedId: keepSelection(prev.doc, s.selectedId) });
      },
      redo: () => {
        const s = get();
        const next = s.future[0];
        if (!next) return;
        set({ doc: next.doc, site: next.site, past: [...s.past, snap()], future: s.future.slice(1), rev: s.rev + 1, lastKey: undefined, selectedId: keepSelection(next.doc, s.selectedId) });
      },
      reset: (doc, site) => set({ doc, ...(site ? { site } : {}), past: [], future: [], rev: 0, savedRev: 0, selectedId: undefined, lastKey: undefined }),
      updateSite: (fn, coalesceKey) => {
        const site = get().site;
        if (!site) return;
        commit(get().doc, coalesceKey ? `site:${coalesceKey}` : undefined, undefined, fn(site));
      },
      restyle: (fn, docFn) => {
        const site = get().site;
        if (!site) return;
        commit(docFn(get().doc), undefined, undefined, fn(site));
      },
      insertSection: (section, index) => {
        const b = blocks();
        if (b.length >= 40 || !CHILDREN.root.includes(section.type)) return undefined;
        const at = Math.max(0, Math.min(index ?? b.length, b.length));
        commit(docWith([...b.slice(0, at), section, ...b.slice(at)]), undefined, section.id);
        return section.id;
      },
      markSaved: (rev) => set({ savedRev: rev }),

      insert: (type, opts) => {
        const b = blocks();
        if (b.length >= 40 && CHILDREN.root.includes(type)) return undefined;
        const point = opts?.parentId ? { parentId: opts.parentId, index: opts.index ?? childCount(b, opts.parentId), wrap: false } : insertionPoint(b, type, get().selectedId);
        if (!point.wrap && !canHold(b, point.parentId, type)) return undefined;
        const node = makeNode(type);
        const placed = point.wrap ? makeNode("section", {}, { children: [node] }) : node;
        commit(docWith(withChildren(b, point.parentId, (kids) => [...kids.slice(0, point.index), placed, ...kids.slice(point.index)])), undefined, node.id);
        return node.id;
      },

      remove: (id) => {
        const b = blocks();
        const at = locate(b, id);
        if (!at) return;
        const parent = at.parentId === "root" ? undefined : findNode(b, at.parentId);
        // Columns keep at least two columns, and cards at least one: removing the last removes the whole block
        if (parent?.type === "columns" && parent.children.length <= 2) return get().remove(parent.id);
        if (parent?.type === "cards" && parent.children.length <= 1) return get().remove(parent.id);
        const siblings = at.parentId === "root" ? b : parent!.children;
        const nextSel = siblings[at.index + 1]?.id ?? siblings[at.index - 1]?.id ?? (at.parentId === "root" ? undefined : at.parentId);
        commit(docWith(removeNode(b, id)), undefined, nextSel ?? "");
        if (!get().selectedId) set({ selectedId: undefined });
      },

      duplicate: (id) => {
        const b = blocks();
        const at = locate(b, id);
        const node = findNode(b, id);
        if (!at || !node) return undefined;
        if (at.parentId === "root" && b.length >= 40) return undefined;
        const parent = at.parentId === "root" ? undefined : findNode(b, at.parentId);
        if (parent?.type === "columns" && parent.children.length >= 4) return undefined;
        if (parent?.type === "cards" && parent.children.length >= 12) return undefined;
        const copy = cloneNode(node);
        commit(docWith(withChildren(b, at.parentId, (kids) => [...kids.slice(0, at.index + 1), copy, ...kids.slice(at.index + 1)])), undefined, copy.id);
        return copy.id;
      },

      moveNode: (id, parentId, index) => {
        const b = blocks();
        const node = findNode(b, id);
        const from = locate(b, id);
        if (!node || !from) return false;
        // Can't move into itself or its own descendants
        if (parentId === id || (parentId !== "root" && findNode(node.children, parentId))) return false;
        const without = removeNode(b, id);
        if (!canHold(without, parentId, node.type)) return false;
        const adjusted = from.parentId === parentId && from.index < index ? index - 1 : index;
        const kids = parentId === "root" ? without : findNode(without, parentId)!.children;
        const at = Math.max(0, Math.min(adjusted, kids.length));
        if (from.parentId === parentId && at === from.index) return false;
        commit(docWith(withChildren(without, parentId, (k) => [...k.slice(0, at), node, ...k.slice(at)])), undefined, id);
        return true;
      },

      moveBy: (id, delta) => {
        const at = locate(blocks(), id);
        if (!at) return false;
        const target = at.index + delta;
        if (target < 0 || target >= childCount(blocks(), at.parentId)) return false;
        return get().moveNode(id, at.parentId, delta > 0 ? target + 1 : target);
      },

      updateProps: (id, patch, coalesceKey) => commit(docWith(mapNode(blocks(), id, (n) => ({ ...n, props: { ...n.props, ...patch } as PageNode["props"] }))), coalesceKey ? `${id}:${coalesceKey}` : undefined),
      updateStyle: (id, patch, coalesceKey) => commit(docWith(mapNode(blocks(), id, (n) => ({ ...n, style: { ...n.style, ...patch } }))), coalesceKey ? `${id}:style:${coalesceKey}` : undefined),
      updateLayout: (id, patch) => commit(docWith(mapNode(blocks(), id, (n) => ({ ...n, layout: { ...n.layout, ...patch } })))),
      updateVisibility: (id, patch) => commit(docWith(mapNode(blocks(), id, (n) => ({ ...n, visibility: { ...n.visibility, ...patch } })))),
      setFocus: (focus) => commit({ ...get().doc, focus: focus || undefined }),
      updatePageStyle: (patch, coalesceKey) => commit({ ...get().doc, style: { ...(get().doc.style ?? styleSchema.parse({})), ...patch } }, coalesceKey ? `page:style:${coalesceKey}` : undefined),
    };
  });
}

function keepSelection(doc: PageDoc, id?: string) {
  return id && (id.startsWith("@") || findNode(doc.blocks, id)) ? id : undefined;
}

function childCount(blocks: PageNode[], parentId: string): number {
  return parentId === "root" ? blocks.length : findNode(blocks, parentId)?.children.length ?? 0;
}

export type EditorStore = ReturnType<typeof createEditorStore>;

/** Content blocks grouped for the Add panel. */
export const BLOCK_GROUPS: { label: string; types: BlockType[] }[] = [
  { label: "Layout", types: ["section", "hero", "columns", "divider", "spacer"] },
  { label: "Text", types: ["heading", "text", "button", "table", "cards"] },
  { label: "Media", types: ["image", "gallery", "video", "marquee"] },
  { label: "Store", types: ["product_card", "product_grid", "collection_list", "offers", "highlights", "testimonials", "about"] },
  { label: "Engage", types: ["faq", "countdown", "newsletter"] },
  { label: "Leads", types: ["lead_form", "booking"] },
  { label: "Advanced", types: ["custom_html"] },
];

export const BLOCK_LABELS: Record<BlockType, string> = {
  section: "Section",
  hero: "Hero",
  columns: "Columns",
  column: "Column",
  heading: "Heading",
  text: "Text",
  button: "Button",
  image: "Image",
  gallery: "Gallery",
  video: "Video",
  table: "Table",
  divider: "Divider",
  spacer: "Spacer",
  product_card: "Product card",
  product_grid: "Product grid",
  highlights: "Highlights",
  testimonials: "Testimonials",
  faq: "FAQ",
  countdown: "Countdown",
  newsletter: "Newsletter",
  lead_form: "Lead form",
  booking: "Booking calendar",
  cards: "Cards",
  card: "Card",
  collection_list: "Collection list",
  offers: "Offers",
  about: "About you",
  marquee: "Scrolling strip",
  custom_html: "Custom HTML",
};

export { CONTENT_TYPES };
