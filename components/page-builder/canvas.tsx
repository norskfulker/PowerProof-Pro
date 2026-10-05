"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, CornerLeftUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { Button } from "@/components/ui/button";
import type { RenderContext } from "@/lib/api";
import { BLOCK_LABELS } from "@/lib/pages/editor-store";
import { findNode, locate, sectionOf, type PageDoc } from "@/lib/pages/schema";
import { cn } from "@/lib/utils";
import { DEVICE_WIDTH } from "./device-preview-switch";
import { useEditor } from "./editor-context";
import { PageRenderer } from "./renderer";

/** Small toolbar pinned to the selected block: parent, up, down, duplicate, delete. */
export function BlockToolbar({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  const selectedId = useEditor((s) => s.selectedId);
  const rev = useEditor((s) => s.rev);
  const device = useEditor((s) => s.device);
  const blocks = useEditor((s) => s.doc.blocks);
  const { select, moveBy, duplicate, remove } = useEditor((s) => s);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const box = container.current;
    if (!box || !selectedId) {
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
        setPos({ top: Math.max(4, a.top - b.top + box.scrollTop - 48), left: Math.max(4, Math.min(a.left - b.left, b.width - 236)) });
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
  return (
    <div role="toolbar" aria-label={`${label} actions`} className="absolute z-20 flex items-center gap-1 rounded-control border bg-surface p-1 shadow-pop pointer-coarse:gap-2" style={{ top: pos.top, left: pos.left }}>
      <span className="px-2 text-xs font-semibold">{label}</span>
      <Button type="button" variant="ghost" size="icon-sm" disabled={at.parentId === "root"} onClick={() => select(at.parentId)} aria-label="Select the block around this one">
        <CornerLeftUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" disabled={at.index === 0} onClick={() => moveBy(node.id, -1)} aria-label={`Move ${label} up`}>
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" disabled={at.index >= siblings - 1} onClick={() => moveBy(node.id, 1)} aria-label={`Move ${label} down`}>
        <ArrowDown />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => (duplicate(node.id) ? undefined : toast.error("Can't duplicate here: that's the limit for this spot."))} aria-label={`Duplicate ${label}`}>
        <Copy />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" className="text-danger" onClick={() => remove(node.id)} aria-label={`Delete ${label}`}>
        <Trash2 />
      </Button>
    </div>
  );
}

/**
 * The live page. Width follows the device switch; the renderer's container queries do the rest.
 * "This section" isolates the selected section; before/after puts the live page beside the draft.
 */
export function Canvas({ context, published, className }: { context: RenderContext; published?: PageDoc; className?: string }) {
  const doc = useEditor((s) => s.doc);
  const selectedId = useEditor((s) => s.selectedId);
  const device = useEditor((s) => s.device);
  const focusSection = useEditor((s) => s.focusSection);
  const compare = useEditor((s) => s.compare);
  const select = useEditor((s) => s.select);
  const box = useRef<HTMLDivElement>(null);

  const section = selectedId ? sectionOf(doc.blocks, selectedId) : undefined;
  const shown: PageDoc = focusSection && section ? { ...doc, blocks: [section] } : doc;
  const width = DEVICE_WIDTH[device];
  const env = { mode: "edit" as const, currency: "INR" as const, selectedId, onSelect: select };

  const frame = (d: PageDoc, label: string, interactive: boolean) => (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {compare && <p className="eyebrow text-center">{label}</p>}
      <div className={cn("mx-auto w-full overflow-hidden rounded-card border bg-background shadow-pop transition-[max-width] duration-300 motion-reduce:transition-none", focusSection && section && "my-6")} style={{ maxWidth: width }}>
        <StoreThemeScope theme={context.theme}>
          <PageRenderer doc={d} context={context} env={interactive ? env : { ...env, selectedId: undefined, onSelect: undefined }} />
        </StoreThemeScope>
      </div>
    </div>
  );

  return (
    <div ref={box} className={cn("relative h-full overflow-auto bg-surface-sunken p-3 md:p-6", className)} aria-label="Page canvas" role="region" onClick={(e) => e.target === e.currentTarget && select(undefined)}>
      {focusSection && !section && <p className="mb-3 text-center text-sm text-muted-foreground">Select a block to see its section on its own.</p>}
      {compare ? (
        <div className="flex flex-col gap-6 xl:flex-row">
          {published ? frame(published, "Live now", false) : <p className="flex-1 rounded-card border border-dashed p-8 text-center text-sm text-muted-foreground">Not published yet.</p>}
          {frame(shown, "Your draft", true)}
        </div>
      ) : (
        frame(shown, "Your draft", true)
      )}
      <BlockToolbar container={box} />
    </div>
  );
}
