"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Copy, Eye, EyeOff, GripVertical, Megaphone, PanelBottom, PanelTop, Plus, Trash2 } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { toast } from "sonner";
import { BLOCK_LABELS } from "@/lib/pages/editor-store";
import { CHILDREN, findNode, locate, sectionOf, type PageNode } from "@/lib/pages/schema";
import { cn } from "@/lib/utils";
import { BLOCK_ICONS } from "./add-block-menu";
import { SITE_PARTS, type SitePart } from "./canvas";
import { useEditor, useEditorStore } from "./editor-context";

/** A short, human label for a block: its own words where it has some. */
export function nodeLabel(n: PageNode): string {
  const p = n.props as Record<string, unknown>;
  const words = (p.label as string) || (p.headline as string) || (p.title as string) || (p.text as string) || (p.heading as string) || "";
  const clean = words.replace(/[*_[\]()]/g, "").replace(/\s+/g, " ").trim();
  if (n.type === "section" && clean) return clean.slice(0, 40);
  return clean ? `${BLOCK_LABELS[n.type]}: ${clean.slice(0, 40)}${clean.length > 40 ? "…" : ""}` : BLOCK_LABELS[n.type];
}

const hiddenEverywhere = (n: PageNode) => !n.visibility.mobile && !n.visibility.desktop;

/** Where a dragged row would land: before or after the row under the pointer */
type Drop = { id: string; where: "before" | "after" };

function IconButton({ label, onClick, disabled, children, className }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }} className={cn("grid size-7 shrink-0 place-items-center rounded-[6px] text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30 pointer-coarse:size-11", className)}>
      {children}
    </button>
  );
}

function Row({ node, depth, index, count, open, onToggle, drag, drop, startDrag }: {
  node: PageNode;
  depth: number;
  index: number;
  count: number;
  open: boolean;
  onToggle?: () => void;
  drag?: string;
  drop?: Drop;
  startDrag: (id: string, e: React.PointerEvent) => void;
}) {
  const selectedId = useEditor((s) => s.selectedId);
  const { select, moveBy, updateVisibility, duplicate, remove, undo } = useEditor((s) => s);
  const Icon = BLOCK_ICONS[node.type];
  const label = nodeLabel(node);
  const hidden = hiddenEverywhere(node);
  const selected = selectedId === node.id;

  // Right-click a row for its options (and Shift F10 or the menu key from the keyboard)
  return (
    <ContextMenu onOpenChange={(o) => o && select(node.id)}>
    <ContextMenuTrigger asChild>
    <div
      data-row-id={node.id}
      className={cn(
        "group relative flex min-h-9 items-center gap-0.5 rounded-control pr-1 text-sm pointer-coarse:min-h-11",
        selected ? "bg-primary-soft text-foreground" : "hover:bg-muted",
        drag === node.id && "opacity-40",
        hidden && "text-muted-foreground"
      )}
      style={{ paddingLeft: depth * 14 }}
    >
      {drop?.id === node.id && <span aria-hidden className={cn("pointer-events-none absolute inset-x-1 h-0.5 rounded bg-primary", drop.where === "before" ? "-top-px" : "-bottom-px")} />}
      <span
        aria-hidden
        title="Drag to move"
        onPointerDown={(e) => startDrag(node.id, e)}
        className="grid h-7 w-4 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground opacity-0 group-hover:opacity-100 pointer-coarse:w-6 pointer-coarse:opacity-100"
      >
        <GripVertical className="size-3.5" />
      </span>
      {onToggle ? (
        <IconButton label={open ? `Collapse ${label}` : `Expand ${label}`} onClick={onToggle} className="size-6">
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
        </IconButton>
      ) : (
        <span className="w-6 shrink-0" aria-hidden />
      )}
      <button type="button" onClick={() => select(node.id)} aria-current={selected ? "true" : undefined} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-control px-1 text-left pointer-coarse:min-h-11">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className={cn("truncate", hidden && "line-through")}>{label}</span>
      </button>
      <span className="flex items-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
        <IconButton label={`Move ${label} up`} disabled={index === 0} onClick={() => moveBy(node.id, -1)}><ArrowUp className="size-3.5" aria-hidden /></IconButton>
        <IconButton label={`Move ${label} down`} disabled={index === count - 1} onClick={() => moveBy(node.id, 1)}><ArrowDown className="size-3.5" aria-hidden /></IconButton>
      </span>
      <IconButton label={hidden ? `Show ${label}` : `Hide ${label}`} onClick={() => updateVisibility(node.id, { mobile: hidden, desktop: hidden })} className={cn(!hidden && "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100")}>
        {hidden ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
      </IconButton>
    </div>
    </ContextMenuTrigger>
    <ContextMenuContent aria-label={`Options for ${label}`}>
      <ContextMenuItem onSelect={() => duplicate(node.id)}><Copy aria-hidden /> Duplicate</ContextMenuItem>
      <ContextMenuItem disabled={index === 0} onSelect={() => moveBy(node.id, -1)}><ArrowUp aria-hidden /> Move up</ContextMenuItem>
      <ContextMenuItem disabled={index === count - 1} onSelect={() => moveBy(node.id, 1)}><ArrowDown aria-hidden /> Move down</ContextMenuItem>
      <ContextMenuItem onSelect={() => updateVisibility(node.id, { mobile: hidden, desktop: hidden })}>{hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />} {hidden ? "Show" : "Hide"}</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={() => { remove(node.id); toast(`${node.type === "section" ? "Section" : "Block"} deleted`, { action: { label: "Undo", onClick: undo } }); }}><Trash2 aria-hidden /> Delete</ContextMenuItem>
    </ContextMenuContent>
    </ContextMenu>
  );
}

function AddRow({ label, onClick, depth }: { label: string; onClick: () => void; depth: number }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-9 w-full items-center gap-2 rounded-control px-2 text-left text-sm font-medium text-primary hover:bg-muted pointer-coarse:min-h-11" style={{ paddingLeft: depth * 14 + 30 }}>
      <Plus className="size-4" aria-hidden /> {label}
    </button>
  );
}

type Dnd = { drag?: string; drop?: Drop; startDrag: (id: string, e: React.PointerEvent) => void };

function Tree({ nodes, depth, expanded, toggle, dnd }: { nodes: PageNode[]; depth: number; expanded: Set<string>; toggle: (id: string) => void; dnd: Dnd }) {
  const setAdding = useEditor((s) => s.setAdding);
  const insert = useEditor((s) => s.insert);
  return (
    <ul className="flex flex-col">
      {nodes.map((n, i) => {
        const holds = CHILDREN[n.type]?.length > 0;
        const open = expanded.has(n.id);
        return (
          <li key={n.id}>
            <Row node={n} depth={depth} index={i} count={nodes.length} open={open} onToggle={holds ? () => toggle(n.id) : undefined} {...dnd} />
            {holds && open && (
              <>
                {n.children.length > 0 && <Tree nodes={n.children} depth={depth + 1} expanded={expanded} toggle={toggle} dnd={dnd} />}
                {n.type === "cards" ? (
                  n.children.length < 12 && <AddRow depth={depth + 1} label="Add card" onClick={() => insert("card", { parentId: n.id, index: n.children.length })} />
                ) : n.type === "columns" ? (
                  n.children.length < 4 && <AddRow depth={depth + 1} label="Add column" onClick={() => insert("column", { parentId: n.id, index: n.children.length })} />
                ) : (
                  <AddRow depth={depth + 1} label="Add block" onClick={() => setAdding({ kind: "block", parentId: n.id })} />
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SitePartRow({ id, icon: Icon, hidden, onToggleHidden }: { id: SitePart; icon: typeof PanelTop; hidden?: boolean; onToggleHidden?: () => void }) {
  const selected = useEditor((s) => s.selectedId === id);
  const select = useEditor((s) => s.select);
  const label = SITE_PARTS[id];
  return (
    <div className={cn("group flex min-h-9 items-center gap-0.5 rounded-control pr-1 text-sm pointer-coarse:min-h-11", selected ? "bg-primary-soft" : "hover:bg-muted", hidden && "text-muted-foreground")}>
      <span className="w-10 shrink-0" aria-hidden />
      <button type="button" onClick={() => select(id)} aria-current={selected ? "true" : undefined} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-control px-1 text-left pointer-coarse:min-h-11">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className={cn("truncate", hidden && "line-through")}>{label}</span>
      </button>
      {onToggleHidden && (
        <IconButton label={hidden ? `Show ${label}` : `Hide ${label}`} onClick={onToggleHidden} className={cn(!hidden && "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100")}>
          {hidden ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
        </IconButton>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-0.5 border-b py-3 last:border-b-0">
      <h3 className="eyebrow px-2 pb-1">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The page as a tree, like Shopify's: the store's header group, this page's sections with their
 * blocks, and the footer. Drag rows to reorder (or use the arrows), hide with the eye, add sections
 * and blocks where they go.
 */
export function LayersPanel({ pageTitle = "Page" }: { pageTitle?: string }) {
  const blocks = useEditor((s) => s.doc.blocks);
  const site = useEditor((s) => s.site);
  const focus = useEditor((s) => !!s.doc.focus);
  const selectedId = useEditor((s) => s.selectedId);
  const setAdding = useEditor((s) => s.setAdding);
  const updateSite = useEditor((s) => s.updateSite);
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<string>();
  const [drop, setDrop] = useState<Drop>();
  const dropRef = useRef<Drop | undefined>(undefined);
  const moveNode = useEditor((s) => s.moveNode);
  const editor = useEditorStore();

  // Dragging by the grip, with a mouse, pen or finger: the row under the pointer shows where it lands
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-row-id]");
      const id = row?.dataset.rowId;
      const next: Drop | undefined = row && id && id !== drag ? { id, where: e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 ? "before" : "after" } : undefined;
      dropRef.current = next;
      setDrop(next);
    };
    const onUp = () => {
      const target = dropRef.current;
      const doc = editor.getState().doc.blocks;
      if (target && doc) {
        const at = locate(doc, target.id);
        const over = findNode(doc, target.id);
        if (at && over) {
          const ok = moveNode(drag, at.parentId, target.where === "after" ? at.index + 1 : at.index);
          // A block dropped on a section (or column) that can hold it goes inside, at the end
          if (!ok && CHILDREN[over.type]?.length) moveNode(drag, over.id, over.children.length);
        }
      }
      dropRef.current = undefined;
      setDrop(undefined);
      setDrag(undefined);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, moveNode, editor]);
  const startDrag = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    setDrag(id);
  };

  // The section holding the selection opens by itself; anything else opens and closes on click
  const expanded = new Set(Object.entries(manual).filter(([, v]) => v).map(([k]) => k));
  if (selectedId && !selectedId.startsWith("@")) {
    let at = locate(blocks, selectedId);
    while (at && at.parentId !== "root") {
      if (manual[at.parentId] !== false) expanded.add(at.parentId);
      at = locate(blocks, at.parentId);
    }
    const sec = sectionOf(blocks, selectedId);
    if (sec && manual[sec.id] !== false && findNode(blocks, selectedId) !== sec) expanded.add(sec.id);
  }
  const toggle = (id: string) => setManual((m) => ({ ...m, [id]: !expanded.has(id) }));
  const announcement = site?.design.sections.find((s) => s.id === "announcement");

  return (
    <nav aria-label="Sections" className="flex flex-col">
      {site && !focus && (
        <Group title="Header">
          <SitePartRow
            id="@announcement"
            icon={Megaphone}
            hidden={!announcement?.enabled}
            onToggleHidden={() =>
              updateSite((s) => ({
                ...s,
                design: {
                  ...s.design,
                  sections: s.design.sections.some((x) => x.id === "announcement") ? s.design.sections.map((x) => (x.id === "announcement" ? { ...x, enabled: !x.enabled } : x)) : [{ id: "announcement", enabled: true }, ...s.design.sections],
                },
              }))
            }
          />
          <SitePartRow id="@header" icon={PanelTop} />
        </Group>
      )}
      <Group title={pageTitle}>
        {blocks.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">No sections yet.</p>}
        <Tree nodes={blocks} depth={0} expanded={expanded} toggle={toggle} dnd={{ drag, drop, startDrag }} />
        {blocks.length < 40 && <AddRow depth={0} label="Add section" onClick={() => setAdding({ kind: "section", index: blocks.length })} />}
      </Group>
      {site && !focus && (
        <Group title="Footer">
          <SitePartRow id="@footer" icon={PanelBottom} />
        </Group>
      )}
    </nav>
  );
}
