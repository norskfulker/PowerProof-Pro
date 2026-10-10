"use client";

import { useState } from "react";
import {
  AlignLeft,
  Columns3,
  Film,
  GalleryHorizontalEnd,
  Heading,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  CalendarClock,
  Code,
  FolderOpen,
  LayoutDashboard,
  MoveHorizontal,
  RectangleHorizontal,
  Tag,
  UserRound,
  ClipboardList,
  Mail,
  Minus,
  MousePointerClick,
  MoveVertical,
  Package,
  Quote,
  Search,
  Sparkles,
  Square,
  Table2,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RenderContext } from "@/lib/api";
import { BLOCK_GROUPS, BLOCK_LABELS } from "@/lib/pages/editor-store";
import { CHILDREN, findNode, type BlockType } from "@/lib/pages/schema";
import { SECTION_PRESETS } from "@/lib/pages/templates";
import { useEditor } from "./editor-context";

export const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  section: Square,
  hero: LayoutTemplate,
  columns: Columns3,
  column: Columns3,
  heading: Heading,
  text: AlignLeft,
  button: MousePointerClick,
  image: ImageIcon,
  gallery: GalleryHorizontalEnd,
  video: Film,
  table: Table2,
  divider: Minus,
  spacer: MoveVertical,
  product_card: Package,
  product_grid: LayoutGrid,
  highlights: Sparkles,
  testimonials: Quote,
  faq: HelpCircle,
  countdown: Timer,
  newsletter: Mail,
  lead_form: ClipboardList,
  booking: CalendarClock,
  cards: LayoutDashboard,
  card: RectangleHorizontal,
  collection_list: FolderOpen,
  offers: Tag,
  about: UserRound,
  marquee: MoveHorizontal,
  custom_html: Code,
};

const HINTS: Partial<Record<BlockType, string>> = {
  section: "Full-width area with a background",
  hero: "Big opening with a headline and button",
  columns: "Side by side, stacks on phones",
  product_grid: "Products or a collection",
  highlights: "Icon and a short line",
  newsletter: "Collect emails",
  lead_form: "Name, email and answers",
  booking: "Visitors pick a free time",
};

/** Searchable list of blocks. Adds after the selection (or into it, if it's a container). `only` limits the choice. */
export function AddBlockMenu({ onAdd, only }: { onAdd: (type: BlockType) => void; only?: BlockType[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const groups = BLOCK_GROUPS.map((g) => ({ ...g, types: g.types.filter((t) => (!only || only.includes(t)) && (!term || BLOCK_LABELS[t].toLowerCase().includes(term) || (HINTS[t] ?? "").toLowerCase().includes(term))) })).filter((g) => g.types.length);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="Search blocks" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search blocks" className="pl-9" />
      </div>
      {groups.length === 0 && <p className="px-1 text-sm text-muted-foreground">No block called “{q}”.</p>}
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-1.5">
          <p className="eyebrow px-1">{g.label}</p>
          <ul className="grid grid-cols-2 gap-2">
            {g.types.map((t) => {
              const Icon = BLOCK_ICONS[t];
              return (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => onAdd(t)}
                    className="flex min-h-16 w-full flex-col items-start gap-1 rounded-control border bg-surface p-2.5 text-left hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={`Add ${BLOCK_LABELS[t]}${HINTS[t] ? `: ${HINTS[t]}` : ""}`}
                  >
                    <Icon className="size-4 text-primary" aria-hidden />
                    <span className="text-sm font-medium">{BLOCK_LABELS[t]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

const PRESET_ICON: Record<string, LucideIcon> = {
  hero: LayoutTemplate,
  "image-banner": ImageIcon,
  "rich-text": AlignLeft,
  "image-with-text": Columns3,
  cards: LayoutDashboard,
  table: Table2,
  highlights: Sparkles,
  image: ImageIcon,
  video: Film,
  gallery: GalleryHorizontalEnd,
  marquee: MoveHorizontal,
  "featured-products": LayoutGrid,
  "collection-list": FolderOpen,
  offers: Tag,
  testimonials: Quote,
  about: UserRound,
  faq: HelpCircle,
  newsletter: Mail,
  countdown: Timer,
  "lead-form": ClipboardList,
  "custom-html": Code,
  blank: Square,
};

/** Ready-made sections, grouped like Shopify's "Add section" */
export function SectionPresetMenu({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const list = SECTION_PRESETS.filter((p) => !term || p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
  const groups = [...new Set(list.map((p) => p.group))];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="Search sections" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sections" className="pl-9" autoFocus />
      </div>
      {list.length === 0 && <p className="px-1 text-sm text-muted-foreground">No section called “{q}”.</p>}
      {groups.map((g) => (
        <div key={g} className="flex flex-col gap-1.5">
          <p className="eyebrow px-1">{g}</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.filter((p) => p.group === g).map((p) => {
              const Icon = PRESET_ICON[p.id] ?? Square;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => onPick(p.id)} className="flex min-h-16 w-full items-start gap-3 rounded-control border bg-surface p-3 text-left hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The picker the tree, the canvas and the toolbar open: a section at a spot, or a block in a section */
export function AddPicker({ context }: { context: RenderContext }) {
  const adding = useEditor((s) => s.adding);
  const blocks = useEditor((s) => s.doc.blocks);
  const { setAdding, insertSection, insert } = useEditor((s) => s);
  const parent = adding?.kind === "block" ? findNode(blocks, adding.parentId) : undefined;
  const allowed = parent ? CHILDREN[parent.type] : [];
  const close = () => setAdding(undefined);

  function pickSection(id: string) {
    if (adding?.kind !== "section") return;
    const preset = SECTION_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const node = preset.build({ slug: context.store.slug, products: context.products.map((p) => ({ id: p.id, title: p.title })), collections: context.collections.map((c) => ({ slug: c.slug, name: c.name })) });
    if (!insertSection(node, adding.index)) return toast.error("That's 40 sections, the most a page can have.");
    close();
    toast.success(`${preset.name} added`, { duration: 1500 });
  }

  function pickBlock(type: BlockType) {
    if (!parent) return;
    if (!insert(type, { parentId: parent.id, index: parent.children.length })) return toast.error(`A ${BLOCK_LABELS[type].toLowerCase()} can't go there.`);
    close();
    toast.success(`${BLOCK_LABELS[type]} added`, { duration: 1500 });
  }

  return (
    <Dialog open={!!adding} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{adding?.kind === "block" ? "Add a block" : "Add a section"}</DialogTitle>
          <DialogDescription>{adding?.kind === "block" ? `Goes at the end of ${parent ? BLOCK_LABELS[parent.type].toLowerCase() : "the section"}. Drag it in the sidebar to move it.` : "Pick a ready-made section. Change anything in it afterwards."}</DialogDescription>
        </DialogHeader>
        {adding?.kind === "block" ? <AddBlockMenu only={allowed} onAdd={pickBlock} /> : <SectionPresetMenu onPick={pickSection} />}
      </DialogContent>
    </Dialog>
  );
}
