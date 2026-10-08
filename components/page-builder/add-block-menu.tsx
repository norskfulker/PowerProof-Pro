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
import { Input } from "@/components/ui/input";
import { BLOCK_GROUPS, BLOCK_LABELS } from "@/lib/pages/editor-store";
import type { BlockType } from "@/lib/pages/schema";

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

/** Searchable list of blocks. Adds after the selection (or into it, if it's a container). */
export function AddBlockMenu({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const groups = BLOCK_GROUPS.map((g) => ({ ...g, types: g.types.filter((t) => !term || BLOCK_LABELS[t].toLowerCase().includes(term) || (HINTS[t] ?? "").toLowerCase().includes(term)) })).filter((g) => g.types.length);
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
