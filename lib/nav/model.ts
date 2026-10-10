import type { LucideIcon } from "lucide-react";
import { ADMIN_NAV, CREATOR_NAV, STORE_NAV, type BadgeKey, type NavNode } from "./config";
import { can, type Need, type StoreAccess } from "../team";

export type { NavNode };

/** A node after the store id, live counts and plan locks are filled in. */
export interface ResolvedNode {
  id: string;
  label: string;
  href?: string;
  icon?: LucideIcon;
  children?: ResolvedNode[];
  count?: number;
  badgeLabel?: string;
  badgeTone?: "alert";
  locked?: "customDomain";
  match?: string[];
  /** A panel of the store editor: found by search, not shown as a tab */
  inEditor?: true;
  /** Labels of the ancestors, for search results */
  path: string[];
}

export interface NavData {
  storeId: string;
  counts: Partial<Record<BadgeKey, number>>;
  /** Pro features the plan doesn't include */
  locked: Set<"customDomain">;
  /** The signed-in person's access to the active store; items they can't open are left out */
  access?: StoreAccess;
}

const BADGE_LABEL: Record<BadgeKey, string> = {
  products_all: "products",
  products_live: "live",
  products_draft: "drafts",
  products_archived: "archived",
  reviews_pending: "waiting for a reply",
  questions_open: "unanswered",
  disputes_open: "open disputes",
  orders_disputed: "open disputes",
  reports_open: "open reports",
  payouts_open: "waiting to be sent",
};
const ALERT: BadgeKey[] = ["reviews_pending", "questions_open", "disputes_open", "orders_disputed", "reports_open", "payouts_open"];

const fill = (s: string, storeId: string) => s.replaceAll("{store}", storeId);

export function resolveNav(tree: NavNode[], data: NavData, path: string[] = [], inherited: Need = "any"): ResolvedNode[] {
  const out: ResolvedNode[] = [];
  for (const n of tree) {
    const need = n.need ?? inherited;
    if (!can(data.access, need)) continue;
    const here = [...path, n.label];
    const children = n.children ? resolveNav(n.children, data, here, need) : undefined;
    // A group whose items are all hidden goes too
    if (n.children && !children?.length) continue;
    const count = n.badge ? data.counts[n.badge] : undefined;
    out.push({
      id: n.id,
      label: n.label,
      href: n.href ? fill(n.href, data.storeId) : undefined,
      icon: n.icon,
      children,
      count: count === undefined || (ALERT.includes(n.badge!) && count === 0) ? undefined : count,
      badgeLabel: n.badge ? BADGE_LABEL[n.badge] : undefined,
      badgeTone: n.badge && ALERT.includes(n.badge) ? "alert" : undefined,
      locked: n.pro && data.locked.has(n.pro) ? n.pro : undefined,
      match: n.match?.map((m) => fill(m, data.storeId)),
      ...(n.inEditor ? { inEditor: true as const } : {}),
      path: here,
    });
  }
  return out;
}

export function flattenNav(tree: ResolvedNode[]): ResolvedNode[] {
  return tree.flatMap((n) => [n, ...(n.children ? flattenNav(n.children) : [])]);
}

function score(n: ResolvedNode, pathname: string, query: URLSearchParams): number {
  if (!n.href) return 0;
  const url = new URL(n.href, "http://x");
  const want = [...url.searchParams.entries()];
  if (url.pathname === pathname) {
    if (want.every(([k, v]) => query.get(k) === v)) return 1000 + want.length * 10;
    return 0;
  }
  if (n.match?.some((m) => pathname.startsWith(m))) return 500 + (n.match.find((m) => pathname.startsWith(m))?.length ?? 0);
  return 0;
}

/** Ancestors and the active node, for auto-expanding the sidebar and picking the active tab. */
export function activeTrail(tree: ResolvedNode[], pathname: string, search = ""): ResolvedNode[] {
  const query = new URLSearchParams(search);
  let best: { s: number; trail: ResolvedNode[] } = { s: 0, trail: [] };
  const walk = (nodes: ResolvedNode[], trail: ResolvedNode[]) => {
    for (const n of nodes) {
      const here = [...trail, n];
      const s = score(n, pathname, query);
      // Deeper wins on a tie, so "Products › All products" beats a parent with the same link
      if (s > best.s || (s === best.s && s > 0 && here.length > best.trail.length)) best = { s, trail: here };
      if (n.children) walk(n.children, here);
    }
  };
  walk(tree, []);
  return best.trail;
}

/** The menu, narrowed to items whose label (or an ancestor's) matches. */
export function filterTree(tree: ResolvedNode[], q: string): ResolvedNode[] {
  const t = q.trim().toLowerCase();
  if (!t) return tree;
  const out: ResolvedNode[] = [];
  for (const n of tree) {
    if (n.label.toLowerCase().includes(t)) out.push(n);
    else if (n.children) {
      const kids = filterTree(n.children, q);
      if (kids.length) out.push({ ...n, children: kids });
    }
  }
  return out;
}

/** Command palette: leaf links whose label or path matches, with the path as context. */
export function navSearch(tree: ResolvedNode[], q: string, limit = 6): ResolvedNode[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return flattenNav(tree)
    .filter((n) => n.href && !n.id.includes("-p-") && n.path.join(" ").toLowerCase().includes(t))
    .sort((a, b) => Number(!a.label.toLowerCase().startsWith(t)) - Number(!b.label.toLowerCase().startsWith(t)) || a.path.length - b.path.length)
    .slice(0, limit);
}

/** The link for a menu item by id, for empty states and other "go there" buttons (Part 7C). */
export function navHref(id: string, storeId = "current"): string {
  const walk = (nodes: NavNode[]): string | undefined => {
    for (const n of nodes) {
      if (n.id === id && n.href) return n.href.replaceAll("{store}", storeId);
      const hit = n.children && walk(n.children);
      if (hit) return hit;
    }
  };
  const href = walk(CREATOR_NAV) ?? walk(STORE_NAV) ?? walk(ADMIN_NAV);
  if (!href) throw new Error(`No menu item "${id}"`);
  return href;
}
