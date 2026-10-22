"use client";

import { useEffect, useState } from "react";
import { GripVertical } from "lucide-react";
import { BLOCK_LABELS } from "@/lib/pages/editor-store";
import { CHILDREN, findNode, locate, type BlockType, type PageNode } from "@/lib/pages/schema";
import { cn } from "@/lib/utils";
import { useEditor, useEditorStore } from "./editor-context";

/**
 * The canvas's own layer over the page: the outline of the block under the pointer (only the
 * innermost one, never every block around it), the selected block's outline, and drag and drop.
 * Outlines are drawn here rather than with CSS on the blocks so they're never clipped by the page
 * edge or hidden under the next section, and always match what a click would select.
 */

type Rect = { top: number; left: number; width: number; height: number };
type Drop = { parentId: string; index: number; line: Rect; inside?: boolean };

const SITE_LABEL: Record<string, string> = { "@announcement": "Announcement bar", "@header": "Header", "@footer": "Footer" };

function labelOf(blocks: PageNode[], id: string) {
  if (id in SITE_LABEL) return SITE_LABEL[id];
  const n = findNode(blocks, id);
  return n ? BLOCK_LABELS[n.type] : "";
}

const elOf = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);

/** A block's box relative to the page, clamped inside it so full-width sections show all four sides */
function rectOf(root: HTMLElement | null, id?: string): Rect | undefined {
  const el = root && id ? elOf(root, id) : null;
  if (!root || !el) return undefined;
  const a = el.getBoundingClientRect();
  const b = root.getBoundingClientRect();
  const left = Math.max(0, a.left - b.left);
  const top = Math.max(0, a.top - b.top);
  return { top, left, width: Math.min(a.right - b.left, b.width) - left, height: Math.min(a.bottom - b.top, b.height) - top };
}

/** While dragging, the page's text can't be selected and the pointer shows a closed hand */
function dragging(doc: Document, on: boolean) {
  doc.body.style.userSelect = on ? "none" : "";
  doc.body.style.cursor = on ? "grabbing" : "";
}

/** The block element under a point, skipping the editor's own controls */
function nodeAt(doc: Document, x: number, y: number): HTMLElement | null {
  for (const el of doc.elementsFromPoint(x, y)) {
    if ((el as HTMLElement).closest("[data-pp-ui]")) continue;
    const hit = (el as HTMLElement).closest<HTMLElement>("[data-node-id]");
    if (hit) return hit;
  }
  return null;
}

/** True when siblings sit side by side (columns, a row of cards) rather than stacked */
function sideBySide(els: HTMLElement[]) {
  if (els.length < 2) return false;
  const a = els[0].getBoundingClientRect();
  const b = els[1].getBoundingClientRect();
  return Math.abs(a.top - b.top) < 4 && Math.abs(a.left - b.left) > 4;
}

/**
 * Where a dragged block would land for a point on the page: walks out from the block under the
 * pointer to the first place that can hold this kind of block, then picks before or after the
 * nearest child there. Empty containers take it inside.
 */
function findDrop(root: HTMLElement, blocks: PageNode[], x: number, y: number, dragId: string, type: BlockType): Drop | undefined {
  const b = root.getBoundingClientRect();
  const dragged = findNode(blocks, dragId);
  const inDragged = (id: string) => id === dragId || (!!dragged && !!findNode(dragged.children, id));

  const among = (parentId: string, kids: PageNode[]): Drop | undefined => {
    const els = kids.map((k) => elOf(root, k.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return undefined;
    const across = sideBySide(els);
    let index = els.length;
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (across ? x < r.left + r.width / 2 && y < r.bottom : y < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    const ref = els[Math.min(index, els.length - 1)].getBoundingClientRect();
    const after = index >= els.length;
    const line: Rect = across
      ? { top: ref.top - b.top, left: (after ? ref.right : ref.left) - b.left - 2, width: 4, height: ref.height }
      : { top: (after ? ref.bottom : ref.top) - b.top - 2, left: Math.max(0, ref.left - b.left), width: Math.min(ref.width, b.width), height: 4 };
    return { parentId, index, line };
  };

  const hit = nodeAt(root.ownerDocument, x, y);
  let id = hit?.dataset.nodeId;
  // Over the header, the footer or the space around sections: sections go at the nearest end
  if (!id || id.startsWith("@")) return CHILDREN.root.includes(type) ? among("root", blocks) : undefined;
  while (id) {
    if (!inDragged(id)) {
      const node = findNode(blocks, id);
      if (!node) break;
      const holds = CHILDREN[node.type]?.includes(type);
      if (holds && node.children.every((c) => c.id === dragId)) {
        const el = elOf(root, id);
        if (el) {
          const r = el.getBoundingClientRect();
          return { parentId: id, index: 0, line: { top: r.top - b.top, left: r.left - b.left, width: r.width, height: r.height }, inside: true };
        }
      }
      // Over a container's own padding: among its children
      if (holds && id === hit?.dataset.nodeId) {
        const d = among(id, node.children);
        if (d) return d;
      }
      const at = locate(blocks, id);
      if (!at) break;
      const parentType = at.parentId === "root" ? "root" : findNode(blocks, at.parentId)?.type;
      if (parentType && CHILDREN[parentType].includes(type)) return among(at.parentId, at.parentId === "root" ? blocks : findNode(blocks, at.parentId)!.children);
    }
    const up = locate(blocks, id);
    id = up && up.parentId !== "root" ? up.parentId : undefined;
  }
  return CHILDREN.root.includes(type) ? among("root", blocks) : undefined;
}

export function CanvasOverlay({ box }: { box: React.RefObject<HTMLDivElement | null> }) {
  const store = useEditorStore();
  const blocks = useEditor((s) => s.doc.blocks);
  const selectedId = useEditor((s) => s.selectedId);
  const device = useEditor((s) => s.device);
  const [hoverId, setHoverId] = useState<string>();
  const [rects, setRects] = useState<{ hover?: Rect; selected?: Rect }>({});
  const [drag, setDrag] = useState<{ id: string; type: BlockType; x: number; y: number; ox: number; oy: number }>();
  const [drop, setDrop] = useState<Drop>();

  // Keep the outlines on their blocks as the page changes: edits, resizes, pictures and fonts loading
  useEffect(() => {
    const root = box.current;
    const win = root?.ownerDocument.defaultView as (Window & typeof globalThis) | null | undefined;
    if (!root || !win) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRects({ hover: rectOf(root, hoverId), selected: rectOf(root, selectedId) }));
    };
    measure();
    const ro = new win.ResizeObserver(measure);
    ro.observe(root);
    root.addEventListener("load", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      root.removeEventListener("load", measure, true);
    };
  }, [box, hoverId, selectedId, blocks, device]);

  // Hover: the innermost block under the pointer
  useEffect(() => {
    const root = box.current;
    if (!root || drag) return;
    const move = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.("[data-pp-ui]")) return;
      setHoverId(t.closest?.<HTMLElement>("[data-node-id]")?.dataset.nodeId);
    };
    const leave = () => setHoverId(undefined);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerleave", leave);
    return () => {
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", leave);
    };
  }, [box, drag]);

  /** Drag a block by its handle; the pointer is followed until it's let go (Escape cancels) */
  function startDrag(id: string, e: React.PointerEvent) {
    const node = findNode(store.getState().doc.blocks, id);
    // The page box this layer covers
    const root = (e.currentTarget as HTMLElement).closest("[data-pp-overlay]")?.parentElement;
    if (!node || !root || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    store.getState().select(id);
    const doc = root.ownerDocument;
    const frameEl = doc.defaultView?.frameElement as HTMLElement | null;
    let last = { x: e.clientX, y: e.clientY };
    let scrollFrame = 0;
    let target: Drop | undefined;
    // The page box doesn't move inside the frame (the frame never scrolls), so its corner is fixed for the drag
    const o = root.getBoundingClientRect();
    setDrag({ id, type: node.type, ...last, ox: o.left, oy: o.top });
    setHoverId(undefined);
    dragging(doc, true);

    const update = () => {
      target = findDrop(root, store.getState().doc.blocks, last.x, last.y, id, node.type);
      setDrop(target);
    };
    // Near the top or bottom of the editor's window, the editor scrolls (the frame itself never does)
    const autoScroll = () => {
      const y = (frameEl?.getBoundingClientRect().top ?? 0) + last.y;
      const top = 150;
      const bottom = window.innerHeight - 70;
      const speed = y < top ? -(top - y) / 4 : y > bottom ? (y - bottom) / 4 : 0;
      if (speed) {
        window.scrollBy(0, Math.max(-24, Math.min(24, speed)));
        update();
      }
      scrollFrame = requestAnimationFrame(autoScroll);
    };
    scrollFrame = requestAnimationFrame(autoScroll);

    const move = (ev: PointerEvent) => {
      last = { x: ev.clientX, y: ev.clientY };
      setDrag((d) => (d ? { ...d, ...last } : d));
      update();
    };
    const end = (commit: boolean) => {
      cancelAnimationFrame(scrollFrame);
      doc.removeEventListener("pointermove", move);
      doc.removeEventListener("pointerup", up);
      doc.removeEventListener("pointercancel", cancel);
      doc.removeEventListener("keydown", key, true);
      dragging(doc, false);
      if (commit && target) store.getState().moveNode(id, target.parentId, target.index);
      setDrop(undefined);
      setDrag(undefined);
    };
    const up = () => end(true);
    const cancel = () => end(false);
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      end(false);
    };
    doc.addEventListener("pointermove", move);
    doc.addEventListener("pointerup", up);
    doc.addEventListener("pointercancel", cancel);
    doc.addEventListener("keydown", key, true);
    update();
  }

  const draggable = (id: string) => !id.startsWith("@") && findNode(blocks, id)?.type !== "column";

  /** The block's name tab with its drag handle: above the hovered block, below the selected one (its toolbar sits above) */
  const tag = (id: string, r: Rect, selected?: boolean) => {
    const below = selected || r.top < 24;
    return (
      <div
        data-pp-ui=""
        className={cn("pointer-events-auto absolute z-50 flex h-6 items-center gap-0.5 pr-2 text-[0.6875rem] font-semibold whitespace-nowrap text-primary-foreground shadow-sm", selected ? "bg-primary" : "bg-primary/85", below ? "rounded-b-[6px]" : "rounded-t-[6px]", draggable(id) ? "pl-0.5" : "pl-2")}
        style={{ top: below ? (selected ? r.top + r.height : r.top) : r.top - 24, left: r.left }}
      >
        {draggable(id) && (
          <button type="button" aria-label={`Drag ${labelOf(blocks, id)} to move it`} title="Drag to move" onPointerDown={(e) => startDrag(id, e)} className="grid h-6 w-5 cursor-grab touch-none place-items-center rounded-[6px] hover:bg-black/15 active:cursor-grabbing">
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        )}
        <button type="button" onClick={() => store.getState().select(id)} className="h-6">
          {labelOf(blocks, id)}
        </button>
      </div>
    );
  };

  const hover = !drag && hoverId && hoverId !== selectedId ? rects.hover : undefined;

  return (
    <div data-pp-overlay="" className="pointer-events-none absolute inset-0 z-40">
      {hover && hoverId && (
        <>
          <div className="absolute rounded-[2px] outline-1 outline-offset-[-1px] outline-primary/70 outline-dashed" style={hover} />
          {tag(hoverId, hover)}
        </>
      )}
      {rects.selected && selectedId && (
        <>
          <div className={cn("absolute rounded-[2px] outline-2 outline-offset-[-2px]", drag ? "bg-primary/10 outline-primary/40 outline-dashed" : "outline-primary outline-solid")} style={rects.selected} />
          {!drag && tag(selectedId, rects.selected, true)}
        </>
      )}
      {drop &&
        (drop.inside ? (
          <div className="absolute rounded-[4px] bg-primary/10 outline-2 outline-offset-[-2px] outline-primary outline-dashed" style={drop.line} />
        ) : (
          <div className="absolute rounded-full bg-primary shadow-[0_0_0_2px_var(--background)]" style={drop.line} />
        ))}
      {drag && (
        <div role="status" className="absolute z-50 rounded-full bg-foreground px-3 py-1 text-xs font-semibold whitespace-nowrap text-background shadow-lg" style={{ top: drag.y - drag.oy + 14, left: drag.x - drag.ox + 14 }}>
          {drop ? `Move ${BLOCK_LABELS[drag.type]} here` : `${BLOCK_LABELS[drag.type]} can't go here`}
        </div>
      )}
    </div>
  );
}
