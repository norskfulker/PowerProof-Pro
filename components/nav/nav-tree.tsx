"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Lock, Search, X } from "lucide-react";
import { usePlan } from "@/components/plan/plan-context";
import { cn } from "@/lib/utils";
import { activeTrail, filterTree, type ResolvedNode } from "@/lib/nav/model";

interface Flat {
  node: ResolvedNode;
  depth: number;
  parentId?: string;
}

const storeKey = (area: string) => `pp:nav-open:${area}`;
const listeners = new Set<() => void>();

function readOpen(area: string): string {
  try {
    return localStorage.getItem(storeKey(area)) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeOpen(area: string, ids: Set<string>) {
  try {
    localStorage.setItem(storeKey(area), JSON.stringify([...ids]));
  } catch {
    /* storage blocked: still works until the next page */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * The sidebar as an ARIA tree (Part 7C): Up/Down move, Right opens or steps in, Left closes or steps
 * out, Home/End jump, Enter follows the link, type-ahead isn't needed because there's a filter box.
 * Open groups are remembered per area; the active page's ancestors always open.
 */
export function NavTree({
  tree,
  area,
  tone = "light",
  collapsed = false,
  onNavigate,
  onExpandRail,
  label = "Main",
}: {
  tree: ResolvedNode[];
  area: "creator" | "admin";
  tone?: "light" | "admin";
  /** Icon rail: only top-level icons; groups open a flyout */
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Icon rail: a group icon opens the full sidebar at that group */
  onExpandRail?: () => void;
  label?: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const plan = usePlan();
  const [query, setQuery] = useState("");
  const [focusId, setFocusId] = useState<string>();
  const refs = useRef(new Map<string, HTMLElement>());

  const trail = useMemo(() => activeTrail(tree, pathname, search.toString()), [tree, pathname, search]);
  const activeId = trail.at(-1)?.id;

  // Groups the creator opened (remembered) plus the path to the current page (always open)
  const storedRaw = useSyncExternalStore(subscribe, () => readOpen(area), () => "[]");
  const stored = useMemo(() => {
    try {
      return new Set(JSON.parse(storedRaw) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [storedRaw]);
  const [closedHere, setClosedHere] = useState<Set<string>>(() => new Set());
  const open = useMemo(() => {
    const o = new Set(stored);
    trail.slice(0, -1).forEach((n) => !closedHere.has(n.id) && o.add(n.id));
    return o;
  }, [stored, trail, closedHere]);

  const shown = useMemo(() => (query.trim() ? filterTree(tree, query) : tree), [tree, query]);
  const filtering = query.trim().length > 0;
  const isOpen = useCallback((id: string) => filtering || open.has(id), [filtering, open]);

  const flat = useMemo(() => {
    const out: Flat[] = [];
    const walk = (nodes: ResolvedNode[], depth: number, parentId?: string) => {
      for (const n of nodes) {
        out.push({ node: n, depth, parentId });
        if (n.children?.length && isOpen(n.id) && !(collapsed && depth === 0)) walk(n.children, depth + 1, n.id);
      }
    };
    walk(shown, 0);
    return out;
  }, [shown, isOpen, collapsed]);

  const current = focusId && flat.some((f) => f.node.id === focusId) ? focusId : (activeId && flat.some((f) => f.node.id === activeId) ? activeId : flat[0]?.node.id);

  const move = (id?: string) => {
    if (!id) return;
    setFocusId(id);
    refs.current.get(id)?.focus();
  };

  const toggle = (id: string, to?: boolean) => {
    const opening = to ?? !open.has(id);
    const next = new Set(stored);
    if (opening) next.add(id);
    else next.delete(id);
    // Closing an ancestor of the current page sticks for this visit too
    setClosedHere((c) => {
      const n = new Set(c);
      if (opening) n.delete(id);
      else n.add(id);
      return n;
    });
    writeOpen(area, next);
  };

  const activate = (n: ResolvedNode) => {
    if (collapsed && n.children?.length) {
      toggle(n.id, true);
      onExpandRail?.();
      return;
    }
    if (n.locked) {
      plan.upgrade(n.locked);
      return;
    }
    if (n.href) {
      router.push(n.href);
      onNavigate?.();
    } else if (n.children?.length) toggle(n.id);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    const i = flat.findIndex((f) => f.node.id === current);
    if (i < 0) return;
    const f = flat[i];
    const hasKids = !!f.node.children?.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(flat[i + 1]?.node.id);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(flat[i - 1]?.node.id);
        break;
      case "Home":
        e.preventDefault();
        move(flat[0]?.node.id);
        break;
      case "End":
        e.preventDefault();
        move(flat.at(-1)?.node.id);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (hasKids && !isOpen(f.node.id)) toggle(f.node.id, true);
        else if (hasKids) move(flat[i + 1]?.node.id);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (hasKids && isOpen(f.node.id) && !filtering) toggle(f.node.id, false);
        else move(f.parentId);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        activate(f.node);
        break;
    }
  }

  const admin = tone === "admin";
  const render = (nodes: ResolvedNode[], depth: number): React.ReactNode =>
    nodes.map((n, i) => {
      const last = i === nodes.length - 1;
      const kids = n.children?.length ? n.children : undefined;
      const expanded = kids ? isOpen(n.id) : undefined;
      const active = n.id === activeId;
      const inTrail = trail.some((t) => t.id === n.id);
      const Icon = n.icon;
      const showKids = kids && expanded && !(collapsed && depth === 0);
      const rowClass = cn(
        "group relative flex min-h-9 w-full items-center gap-2.5 rounded-control pr-2 text-left text-sm outline-none transition-colors pointer-coarse:min-h-11",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        depth === 0 ? "font-semibold" : "font-medium",
        admin
          ? active
            ? "bg-sidebar-admin-foreground/12 text-sidebar-admin-foreground"
            : "text-sidebar-admin-foreground/80 hover:bg-sidebar-admin-foreground/8 hover:text-sidebar-admin-foreground"
          : active
            ? "bg-primary-soft text-primary"
            : inTrail && depth === 0
              ? "text-foreground"
              : "text-foreground/80 hover:bg-muted hover:text-foreground",
        collapsed && depth === 0 ? "justify-center px-0" : ""
      );
      const indent = collapsed && depth === 0 ? undefined : { paddingLeft: depth === 0 ? "0.75rem" : "0.5rem" };
      const content = (
        <>
          {active && <span className="absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r-full bg-accent" aria-hidden />}
          {Icon ? <Icon className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden /> : depth > 0 && !collapsed ? null : null}
          <span className={cn("min-w-0 flex-1 truncate", collapsed && depth === 0 && "sr-only")}>{n.label}</span>
          {n.count !== undefined && !(collapsed && depth === 0) && (
            <span className={cn("shrink-0 rounded-full px-1.5 py-px font-mono text-[0.6875rem] tabular-nums", admin ? "bg-sidebar-admin-foreground/12" : n.badgeTone === "alert" ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground")}>
              {n.count}
              <span className="sr-only"> {n.badgeLabel}</span>
            </span>
          )}
          {n.locked && <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pro feature" />}
          {kids && !(collapsed && depth === 0) && <ChevronRight className={cn("size-4 shrink-0 opacity-60 transition-transform", expanded && "rotate-90")} aria-hidden />}
        </>
      );
      const common = {
        ref: (el: HTMLElement | null) => {
          if (el) refs.current.set(n.id, el);
          else refs.current.delete(n.id);
        },
        role: "treeitem" as const,
        "aria-level": depth + 1,
        "aria-expanded": expanded,
        "aria-current": active ? ("page" as const) : undefined,
        "aria-selected": active,
        tabIndex: n.id === current ? 0 : -1,
        onFocus: () => setFocusId(n.id),
        className: rowClass,
        style: indent,
        title: collapsed && depth === 0 ? n.label : undefined,
      };
      const line = admin ? "bg-sidebar-admin-foreground/25" : "bg-border-strong";
      return (
        <li key={n.id} role="none" className={cn(depth > 0 && "relative ml-3 pl-3")}>
          {/* The tree: a line down the side of a group's items, with a short branch to each */}
          {depth > 0 && (
            <>
              <span aria-hidden className={cn("absolute top-0 left-0 w-px", line, last ? "h-[1.125rem]" : "h-full")} />
              <span aria-hidden className={cn("absolute top-[1.125rem] left-0 h-px w-3", line)} />
            </>
          )}
          {n.href && !n.locked ? (
            <Link {...common} href={n.href} onClick={() => onNavigate?.()}>
              {content}
            </Link>
          ) : (
            <button {...common} type="button" onClick={() => activate(n)}>
              {content}
            </button>
          )}
          {showKids && (
            <ul role="group" className="flex flex-col gap-0.5 pt-0.5">
              {render(kids, depth + 1)}
            </ul>
          )}
        </li>
      );
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!collapsed && (
        <div className="relative px-3 pb-2">
          <Search className={cn("pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2", admin ? "text-sidebar-admin-foreground/60" : "text-muted-foreground")} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                move(flat[0]?.node.id);
              }
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Filter menu"
            aria-label="Filter menu"
            className={cn(
              "h-9 w-full rounded-control border pr-8 pl-9 text-sm outline-none pointer-coarse:h-11 focus-visible:outline-2 focus-visible:outline-ring",
              admin ? "border-sidebar-admin-foreground/20 bg-sidebar-admin-foreground/8 text-sidebar-admin-foreground placeholder:text-sidebar-admin-foreground/60" : "border-border bg-surface-sunken placeholder:text-muted-foreground"
            )}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear filter" className="absolute top-1/2 right-4 grid size-7 -translate-y-1/2 place-items-center rounded-control pointer-coarse:size-11">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      )}
      <nav aria-label={label} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {shown.length === 0 ? (
          <p className={cn("px-3 py-2 text-sm", admin ? "text-sidebar-admin-foreground/70" : "text-muted-foreground")}>Nothing in the menu matches “{query}”.</p>
        ) : (
          <ul role="tree" aria-label={label} onKeyDown={onKeyDown} className="flex flex-col gap-0.5">
            {render(shown, 0)}
          </ul>
        )}
      </nav>
    </div>
  );
}

