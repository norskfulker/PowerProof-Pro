import { describe, expect, it } from "vitest";
import { ADMIN_NAV, CREATOR_NAV, MOBILE_TABS, STORE_NAV, type NavNode } from "./config";
import { activeTrail, filterTree, flattenNav, navSearch, resolveNav, type NavData } from "./model";

const data: NavData = {
  storeId: "store_fx",
  counts: { products_all: 17, products_live: 12, products_draft: 4, products_archived: 1, reviews_pending: 3, orders_disputed: 0 },
  locked: new Set(["customDomain"]),
};
const tree = resolveNav(CREATOR_NAV, data);
const storeTree = resolveNav(STORE_NAV, data, ["Store"]);
const walk = (nodes: NavNode[]): NavNode[] => nodes.flatMap((n) => [n, ...(n.children ? walk(n.children) : [])]);

describe("nav config", () => {
  it("has unique ids and every leaf has a link", () => {
    for (const nav of [CREATOR_NAV, STORE_NAV, ADMIN_NAV]) {
      const all = walk(nav);
      expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
      for (const n of all) if (!n.children?.length) expect(n.href, n.id).toBeTruthy();
    }
  });
  it("keeps the nested groups in business-flow order: Catalog, Sales, then Store", () => {
    expect(CREATOR_NAV.map((g) => g.label)).toEqual(["Dashboard", "Catalog", "Sales", "Store", "Marketplace", "Tools", "Settings"]);
    expect(ADMIN_NAV.map((g) => g.label)).toEqual(["Overview", "Creators", "Stores", "Products", "Orders", "Money", "Moderation", "System"]);
  });
  it("puts Home, Products, Orders and Settings in the tab bar", () => {
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(["Home", "Products", "Orders", "Settings"]);
  });
});

describe("resolveNav", () => {
  it("fills the store id, counts and locks", () => {
    const flat = [...flattenNav(tree), ...flattenNav(storeTree)];
    expect(flat.find((n) => n.id === "design-base")?.href).toBe("/store/store_fx/design/pages/home/edit");
    expect(flat.find((n) => n.id === "products")?.count).toBe(17);
    expect(flat.find((n) => n.id === "reviews")?.count).toBe(3);
    expect(flat.find((n) => n.id === "orders")?.count).toBeUndefined();
    // Domain is its own setting, with its own Pro lock
    expect(flat.find((n) => n.id === "settings-domain")?.locked).toBe("customDomain");
    expect(flat.find((n) => n.id === "settings-domain")?.href).toBe("/store/store_fx/domain");
  });
  it("makes Store one plain sidebar item whose sections are tabs, and Store settings sit in Settings without an icon", () => {
    const store = tree.find((g) => g.id === "store")!;
    expect(store.href).toBe("/store/store_fx/design/pages/home/edit");
    expect(store.children).toBeUndefined();
    expect(storeTree.map((t) => t.label)).toEqual(["Design", "Policies", "Offers", "SEO"]);
  });
  it("opens Pages, About, FAQ, reviews and questions as panels of the store editor, still found by search with their badges", () => {
    const design = storeTree.find((t) => t.id === "design")!;
    const panels = design.children!.filter((c) => c.inEditor);
    expect(panels.map((c) => c.label)).toEqual(["Pages", "About", "FAQ", "Reviews", "Questions"]);
    expect(panels.find((c) => c.id === "reviews")).toMatchObject({ href: "/store/store_fx/design/pages/home/edit?panel=reviews", count: 3 });
    expect(navSearch(storeTree, "faq")[0].href).toBe("/store/store_fx/design/pages/home/edit?panel=faq");
    const settings = tree.find((g) => g.id === "settings")!.children!.find((c) => c.id === "settings-store")!;
    expect(settings.href).toBe("/store/store_fx/settings");
    expect(settings.icon).toBeUndefined();
  });
  it("makes groups only open and close: they have no page of their own", () => {
    for (const id of ["catalog", "sales", "tools", "settings"]) {
      const g = tree.find((x) => x.id === id)!;
      expect(g.href, id).toBeUndefined();
      expect(g.children?.length, id).toBeGreaterThan(0);
    }
  });
  it("keeps Collections, Products, Orders and Payouts as plain links, not nested", () => {
    const flat = flattenNav(tree);
    for (const id of ["collections", "products", "orders", "payouts"]) {
      const n = flat.find((x) => x.id === id)!;
      expect(n.href, id).toBeTruthy();
      expect(n.children, id).toBeUndefined();
    }
    expect(tree.find((g) => g.id === "catalog")!.children!.map((c) => c.label)).toEqual(["Collections", "Products", "Bundles", "Marketplace deals", "Media library"]);
    expect(tree.find((g) => g.id === "sales")!.children!.map((c) => c.label)).toEqual(["Orders", "Customers", "Leads", "Payouts"]);
  });
});

describe("activeTrail", () => {
  it("keeps Products active for every status tab", () => {
    expect(activeTrail(tree, "/catalog/products", "status=live").map((n) => n.label)).toEqual(["Catalog", "Products"]);
    expect(activeTrail(tree, "/catalog/products", "").map((n) => n.label)).toEqual(["Catalog", "Products"]);
  });
  it("covers detail pages with match prefixes", () => {
    expect(activeTrail(tree, "/sales/orders/ord_1078").map((n) => n.label)).toEqual(["Sales", "Orders"]);
    expect(activeTrail(storeTree, "/store/store_fx/pages/policies/refund").map((n) => n.label)).toEqual(["Policies", "Refund"]);
  });
  it("returns nothing for pages outside the menu", () => {
    expect(activeTrail(tree, "/nowhere")).toEqual([]);
  });
});

describe("filter and search", () => {
  it("keeps the ancestors of matching items", () => {
    const f = filterTree(storeTree, "refund");
    expect(f.map((n) => n.label)).toEqual(["Policies"]);
  });
  it("finds leaf links by label or path, best first", () => {
    const r = navSearch([...tree, ...storeTree], "coupons");
    expect(r[0].href).toBe("/store/store_fx/offers/coupons");
    expect(navSearch(tree, "")).toEqual([]);
  });
});
