import { describe, expect, it } from "vitest";
import { ADMIN_NAV, CREATOR_NAV, MOBILE_TABS, type NavNode } from "./config";
import { activeTrail, filterTree, flattenNav, navSearch, resolveNav, type NavData } from "./model";

const data: NavData = {
  storeId: "store_fx",
  counts: { products_all: 17, products_live: 12, products_draft: 4, products_archived: 1, reviews_pending: 3, orders_disputed: 0 },
  collections: [
    { id: "col_a", name: "Notion kits", products: Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, title: `Kit ${i}` })) },
    { id: "col_b", name: "Empty", products: [] },
  ],
  locked: new Set(["customDomain"]),
};
const tree = resolveNav(CREATOR_NAV, data);
const walk = (nodes: NavNode[]): NavNode[] => nodes.flatMap((n) => [n, ...(n.children ? walk(n.children) : [])]);

describe("nav config", () => {
  it("has unique ids and every leaf has a link", () => {
    for (const nav of [CREATOR_NAV, ADMIN_NAV]) {
      const all = walk(nav);
      expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
      for (const n of all) if (!n.children?.length && !n.dynamic) expect(n.href, n.id).toBeTruthy();
    }
  });
  it("keeps the nested groups in business-flow order: Catalog, Sales, then Store", () => {
    expect(CREATOR_NAV.map((g) => g.label)).toEqual(["Home", "Catalog", "Sales", "Store", "Tools", "Settings"]);
    expect(ADMIN_NAV.map((g) => g.label)).toEqual(["Overview", "Creators", "Stores", "Orders", "Money", "Moderation", "System"]);
  });
  it("puts Home, Products, Orders and Settings in the tab bar", () => {
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(["Home", "Products", "Orders", "Settings"]);
  });
});

describe("resolveNav", () => {
  it("fills the store id, counts and locks", () => {
    const flat = flattenNav(tree);
    expect(flat.find((n) => n.id === "design-base")?.href).toBe("/store/store_fx/design/base");
    expect(flat.find((n) => n.id === "products-live")?.count).toBe(12);
    expect(flat.find((n) => n.id === "reviews")?.count).toBe(3);
    expect(flat.find((n) => n.id === "orders-disputed")?.count).toBeUndefined();
    expect(flat.find((n) => n.id === "domain")?.locked).toBe("customDomain");
  });
  it("lists each collection with its first 5 products and View all", () => {
    const col = flattenNav(tree).find((n) => n.id === "col-col_a")!;
    expect(col.children!.map((c) => c.label)).toEqual(["Kit 0", "Kit 1", "Kit 2", "Kit 3", "Kit 4", "View all 7"]);
    expect(col.count).toBe(7);
  });
});

describe("activeTrail", () => {
  it("matches the query string for status filters", () => {
    expect(activeTrail(tree, "/catalog/products", "status=live").map((n) => n.label)).toEqual(["Catalog", "Products", "Live"]);
    expect(activeTrail(tree, "/catalog/products", "").map((n) => n.label)).toEqual(["Catalog", "Products", "All products"]);
  });
  it("covers detail pages with match prefixes", () => {
    expect(activeTrail(tree, "/sales/orders/ord_1078").map((n) => n.label)).toEqual(["Sales", "Orders", "All"]);
    expect(activeTrail(tree, "/store/store_fx/pages/policies/refund").map((n) => n.label)).toEqual(["Store", "Info pages", "Policies", "Refund"]);
  });
  it("returns nothing for pages outside the menu", () => {
    expect(activeTrail(tree, "/nowhere")).toEqual([]);
  });
});

describe("filter and search", () => {
  it("keeps the ancestors of matching items", () => {
    const f = filterTree(tree, "refund");
    expect(f.map((n) => n.label)).toEqual(["Sales", "Store"]);
  });
  it("finds leaf links by label or path, best first", () => {
    const r = navSearch(tree, "coupons");
    expect(r[0].href).toBe("/store/store_fx/offers/coupons");
    expect(navSearch(tree, "")).toEqual([]);
  });
});
