/**
 * Workspace teams: who can work on which part of every store in a workspace. The database decides
 * (store_can() in every policy, asked of the store's workspace since migration 063); this file
 * names the areas for the screens, and maps each screen to the area it needs so the menu and pages
 * can say "not for you" instead of showing empty data.
 */

export const TEAM_AREAS = [
  { id: "catalog", label: "Products", body: "Products, collections, media, SKUs and tax codes" },
  { id: "orders", label: "Orders and customers", body: "Orders, shipping, refunds, customers, leads, reviews and questions" },
  { id: "design", label: "Store design", body: "The store editor, pages, policies, SEO, analytics tags and the domain" },
  { id: "marketing", label: "Offers", body: "Coupons, bundles and deal paths" },
  { id: "analytics", label: "Analytics", body: "Sales figures, buyers and visitor numbers on the Analytics page" },
  { id: "business", label: "Business details", body: "Store settings, company, invoice name and tax" },
  { id: "agents", label: "Agents", body: "The workspace's agents, their send queue and connections" },
  { id: "marketplace", label: "Marketplace", body: "Listing and managing marketplace deals" },
] as const;

export type TeamArea = (typeof TEAM_AREAS)[number]["id"];
export const ALL_AREAS: TeamArea[] = TEAM_AREAS.map((a) => a.id);

export type StoreRole = "owner" | "admin" | "member";

/** What the signed-in person may do in a workspace (and so in each of its stores) */
export interface StoreAccess {
  role: StoreRole;
  areas: TeamArea[];
}

export const OWNER_ACCESS: StoreAccess = { role: "owner", areas: ALL_AREAS };

/**
 * What a screen needs: an area, "team" (the owner and admins), "owner" (money and the plan),
 * or "any" (everyone on the team).
 */
export type Need = TeamArea | "team" | "owner" | "any";

export function can(access: StoreAccess | undefined, need: Need): boolean {
  // Until access loads, nothing is hidden (the database still refuses what isn't allowed)
  if (!access || access.role === "owner" || need === "any") return true;
  if (need === "owner") return false;
  if (need === "team") return access.role === "admin";
  return access.role === "admin" || access.areas.includes(need);
}

export const roleLabel = (r: StoreRole) => (r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Limited");

export const areaLabels = (areas: readonly string[]) => TEAM_AREAS.filter((a) => areas.includes(a.id)).map((a) => a.label);

/** The area a creator-app address belongs to ("any" when everyone on the team can open it) */
export function needForPath(path: string): Need {
  const p = path.split("?")[0];
  const store = p.match(/^\/store\/[^/]+(\/.*)?$/);
  if (store) {
    const rest = store[1] ?? "";
    if (rest.startsWith("/offers")) return "marketing";
    if (rest.startsWith("/settings")) return "business";
    return "design";
  }
  if (p.startsWith("/catalog/bundles")) return "marketing";
  if (p.startsWith("/agents")) return "agents";
  if (p.startsWith("/analytics")) return "analytics";
  if (p.startsWith("/catalog")) return "catalog";
  if (p.startsWith("/sales/payouts")) return "owner";
  if (p.startsWith("/sales")) return "orders";
  if (p.startsWith("/settings/billing")) return "owner";
  if (p.startsWith("/settings/team")) return "any";
  if (p.startsWith("/settings/skus")) return "catalog";
  if (p.startsWith("/settings/company") || p.startsWith("/settings/tax")) return "business";
  if (p.startsWith("/tools")) return "design";
  if (p.startsWith("/getting-started")) return "owner";
  return "any";
}
