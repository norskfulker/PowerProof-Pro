"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uid } from "@/lib/uid";
import type { PageBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

const BLOCK_LABEL: Record<PageBlock["type"], string> = {
  hero: "Hero",
  features: "What's inside",
  testimonial: "Quote",
  faq: "FAQ",
  buy: "Buy button",
  text: "Text",
};

const BODY_HINT: Partial<Record<PageBlock["type"], string>> = {
  features: "One item per line.",
  faq: "One question per line, as Question|Answer.",
  testimonial: "Who said it.",
  buy: "Small print under the button.",
};

const NEW_BLOCK: Record<PageBlock["type"], Omit<PageBlock, "id" | "type">> = {
  hero: { heading: "A headline", body: "A line about it." },
  features: { heading: "What's inside", body: "One thing\nAnother thing" },
  testimonial: { heading: "“A kind word from a buyer.”", body: "Name, what they do" },
  faq: { heading: "Questions", body: "Question?|Answer." },
  buy: { heading: "Get it now", body: "Instant download." },
  text: { heading: "A heading", body: "Some words." },
};

export function BlockList({
  blocks,
  selectedId,
  onSelect,
  onChange,
}: {
  blocks: PageBlock[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onChange: (b: PageBlock[]) => void;
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Blocks</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm"><Plus aria-hidden /> Add</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(NEW_BLOCK) as PageBlock["type"][]).map((t) => (
              <DropdownMenuItem
                key={t}
                onSelect={() => {
                  const b = { id: uid("b"), type: t, ...NEW_BLOCK[t] };
                  onChange([...blocks, b]);
                  onSelect(b.id);
                }}
              >
                {BLOCK_LABEL[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ol className="flex flex-col gap-1.5">
        {blocks.map((b, i) => (
          <li
            key={b.id}
            className={cn("flex items-center gap-1 rounded-control border bg-surface pl-3", selectedId === b.id && "border-primary bg-primary-soft")}
          >
            <button type="button" onClick={() => onSelect(b.id)} className="min-h-11 min-w-0 flex-1 text-left" aria-current={selectedId === b.id || undefined}>
              <span className="block font-mono text-[10px] text-muted-foreground uppercase">{BLOCK_LABEL[b.type]}</span>
              <span className="block truncate text-sm font-medium">{b.heading}</span>
            </button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${BLOCK_LABEL[b.type]} up`}><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${BLOCK_LABEL[b.type]} down`}><ArrowDown /></Button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function BlockInspector({ block, onChange, onDelete }: { block: PageBlock; onChange: (b: PageBlock) => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Editing · {BLOCK_LABEL[block.type]}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-danger hover:bg-danger-soft">
          <Trash2 aria-hidden /> Remove
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="blk-h">Heading</Label>
        <Input id="blk-h" value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="blk-b">Text</Label>
        <Textarea id="blk-b" rows={5} value={block.body} onChange={(e) => onChange({ ...block, body: e.target.value })} aria-describedby="blk-b-h" />
        {BODY_HINT[block.type] && <p id="blk-b-h" className="text-sm text-muted-foreground">{BODY_HINT[block.type]}</p>}
      </div>
    </div>
  );
}
