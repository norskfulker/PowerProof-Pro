import { describe, expect, it } from "vitest";
import { classify, runSearch, type Indexed } from "./search";

const item = (over: Partial<Indexed> & Pick<Indexed, "type" | "id" | "title">): Indexed => ({
  storeSlug: "fixture-store",
  storeName: "Fixture Store",
  href: "/x",
  actions: ["open", "copy"],
  text: over.title.toLowerCase(),
  rawEmails: [],
  rawPhones: [],
  ...over,
});

const ORDERS = Array.from({ length: 8 }, (_, i) =>
  item({ type: "order", id: `o${i}`, number: `PP-${2001 + i}`, title: `PP-${2001 + i}`, status: i % 2 ? "refunded" : "paid", date: new Date(Date.now() - i * 86_400_000).toISOString(), rawEmails: [`buyer${i}@test.invalid`], text: `pp-${2001 + i} buyer ${i} fixture product` })
);
const INDEX: Indexed[] = [
  ...ORDERS,
  item({ type: "product", id: "p1", title: "Fixture second brain", text: "fixture second brain notion" }),
  item({ type: "product", id: "p2", title: "Fixture planner", text: "fixture planner" }),
  item({ type: "coupon", id: "c1", title: "TESTCODE", text: "testcode" }),
];

describe("classify", () => {
  it("reads order numbers", () => {
    expect(classify("#2042")).toEqual({ kind: "order", digits: "2042" });
    expect(classify("PP-2042")).toEqual({ kind: "order", digits: "2042" });
    expect(classify("2042")).toEqual({ kind: "order", digits: "2042" });
  });
  it("reads emails, phones, stores and invoices", () => {
    expect(classify("buyer@test.invalid").kind).toBe("email");
    expect(classify("buyer@").kind).toBe("email");
    expect(classify("+91 98765 43210")).toEqual({ kind: "phone", digits: "919876543210" });
    expect(classify("@my-store planner")).toEqual({ kind: "store", slug: "my-store", rest: "planner" });
    expect(classify("INV-0012").kind).toBe("invoice");
  });
  it("falls back to words", () => {
    expect(classify("  second  brain ")).toEqual({ kind: "text", words: ["second", "brain"] });
  });
});

describe("runSearch", () => {
  it("finds an order by number", () => {
    const r = runSearch(INDEX, "#2003");
    expect(r.pattern).toBe("order");
    expect(r.groups[0].type).toBe("order");
    expect(r.groups[0].results[0].title).toBe("PP-2003");
  });

  it("matches words across the record", () => {
    const r = runSearch(INDEX, "second brain");
    expect(r.groups.map((g) => g.type)).toEqual(["product"]);
    expect(r.total).toBe(1);
  });

  it("matches a full email without returning it", () => {
    const r = runSearch(INDEX, "buyer3@test.invalid");
    expect(r.pattern).toBe("email");
    expect(r.total).toBe(1);
    expect(JSON.stringify(r.groups)).not.toContain("rawEmails");
  });

  it("caps each group and reports the total", () => {
    const r = runSearch(INDEX, "fixture", {}, 5);
    const orders = r.groups.find((g) => g.type === "order")!;
    expect(orders.results).toHaveLength(5);
    expect(orders.total).toBe(8);
  });

  it("applies type, status and date filters", () => {
    const r = runSearch(INDEX, "fixture", { types: ["order"], status: "refunded", days: 3650 });
    expect(r.groups.map((g) => g.type)).toEqual(["order"]);
    expect(r.groups[0].results.every((x) => x.status === "refunded")).toBe(true);
  });

  it("returns nothing for no match", () => {
    expect(runSearch(INDEX, "zzzz-no-such-thing").groups).toEqual([]);
  });
});
