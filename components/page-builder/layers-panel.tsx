"use client";

import { ArrowDown, ArrowUp, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BLOCK_LABELS } from "@/lib/pages/editor-store";
import type { PageNode } from "@/lib/pages/schema";
import { cn } from "@/lib/utils";
import { BLOCK_ICONS } from "./add-block-menu";
import { useEditor } from "./editor-context";

/** A short, human label for a block: its own words where it has some. */
export function nodeLabel(n: PageNode): string {
  const p = n.props as Record<string, unknown>;
  const words = (p.label as string) || (p.headline as string) || (p.text as string) || (p.heading as string) || "";
  const clean = words.replace(/[*_[\]()]/g, "").replace(/\s+/g, " ").trim();
  return clean ? `${BLOCK_LABELS[n.type]}: ${clean.slice(0, 40)}${clean.length > 40 ? "…" : ""}` : BLOCK_LABELS[n.type];
}

function Rows({ nodes, depth }: { nodes: PageNode[]; depth: number }) {
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const moveBy = useEditor((s) => s.moveBy);
  return (
    <ul className={cn("flex flex-col", depth > 0 && "ml-3 border-l pl-2")} >
      {nodes.map((n, i) => {
        const Icon = BLOCK_ICONS[n.type];
        const hidden = !n.visibility.mobile || !n.visibility.desktop;
        const label = nodeLabel(n);
        return (
          <li key={n.id}>
            <div className={cn("group flex min-h-10 items-center gap-1 rounded-control pr-1 pointer-coarse:min-h-11 pointer-coarse:gap-2", selectedId === n.id ? "bg-primary-soft" : "hover:bg-muted")}>
              <button
                type="button"
                onClick={() => select(n.id)}
                aria-current={selectedId === n.id ? "true" : undefined}
                className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-control px-2 text-left text-sm pointer-coarse:min-h-11"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{label}</span>
                {hidden && (
                  <span className="ml-auto shrink-0 text-muted-foreground" title={!n.visibility.mobile ? "Hidden on phones" : "Hidden on desktop"}>
                    <EyeOff className="size-3.5" aria-hidden />
                    <span className="sr-only">{!n.visibility.mobile && !n.visibility.desktop ? "Hidden everywhere" : !n.visibility.mobile ? "Hidden on phones" : "Hidden on desktop"}</span>
                  </span>
                )}
              </button>
              <Button type="button" variant="ghost" size="icon-sm" className="size-8 pointer-coarse:size-11" disabled={i === 0} onClick={() => moveBy(n.id, -1)} aria-label={`Move ${label} up`}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" className="size-8 pointer-coarse:size-11" disabled={i === nodes.length - 1} onClick={() => moveBy(n.id, 1)} aria-label={`Move ${label} down`}>
                <ArrowDown />
              </Button>
            </div>
            {n.children.length > 0 && <Rows nodes={n.children} depth={depth + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

/** Every block in page order. Select, and move up or down within its parent. */
export function LayersPanel() {
  const blocks = useEditor((s) => s.doc.blocks);
  if (!blocks.length) return <p className="px-1 text-sm text-muted-foreground">No blocks yet. Add a section from the Add tab.</p>;
  return (
    <nav aria-label="Layers">
      <Rows nodes={blocks} depth={0} />
    </nav>
  );
}
