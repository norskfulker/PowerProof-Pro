import { describe, expect, it } from "vitest";
import { CHILDREN, cloneNode, countNodes, findNode, locate, makeNode, mediaSrc, pageDocSchema, safeHref, sectionOf, type PageDoc, type PageNode } from "./schema";
import { PAGE_TEMPLATES } from "./templates";

const ctx = {
  storeName: "Fixture Store",
  ownerName: "Test Owner",
  slug: "my-store",
  products: [
    { id: "p1", title: "One" },
    { id: "p2", title: "Two" },
  ],
  collections: [{ slug: "kits", name: "Kits" }],
  brand: "#0F3D33",
  accent: "#C9A24F",
  now: Date.parse("2026-10-05T05:30:00Z"),
};

const doc = (...blocks: PageDoc["blocks"]): PageDoc => ({ version: 1, blocks });

describe("templates", () => {
  it.each(PAGE_TEMPLATES.map((t) => [t.id, t] as const))("%s builds a valid page", (_, t) => {
    const d = t.build(ctx);
    const r = pageDocSchema.safeParse(d);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
    expect(d.blocks.length).toBeGreaterThan(t.id === "blank" ? 0 : 1);
  });

  it("has four templates (launch, sale, bio, blank) with unique ids", () => {
    expect(new Set(PAGE_TEMPLATES.map((t) => t.id)).size).toBe(4);
  });

  it("works for a store with no products or collections", () => {
    for (const t of PAGE_TEMPLATES) {
      expect(pageDocSchema.safeParse(t.build({ ...ctx, products: [], collections: [] })).success).toBe(true);
    }
  });
});

describe("schema rules", () => {
  it("rejects content at the top level", () => {
    const r = pageDocSchema.safeParse(doc(makeNode("heading", { text: "Hi" })));
    expect(r.success).toBe(false);
  });

  it("rejects a section inside a section", () => {
    const bad = makeNode("section", {}, { children: [makeNode("section")] });
    expect(pageDocSchema.safeParse(doc(bad)).success).toBe(false);
  });

  it("requires 2 to 4 columns", () => {
    const one = makeNode("columns", {}, { children: [makeNode("column")] });
    expect(pageDocSchema.safeParse(doc(makeNode("section", {}, { children: [one] }))).success).toBe(false);
    const two = makeNode("columns");
    expect(pageDocSchema.safeParse(doc(makeNode("section", {}, { children: [two] }))).success).toBe(true);
  });

  it("rejects duplicate ids", () => {
    const a = makeNode("section", {}, { id: "same" });
    expect(pageDocSchema.safeParse(doc(a, { ...a })).success).toBe(false);
  });

  it("validates props against each block's schema", () => {
    const bad = makeNode("section", {}, { children: [{ ...makeNode("heading", { text: "x" }), props: { text: "", level: 2, size: "lg" } }] });
    const r = pageDocSchema.safeParse(doc(bad));
    expect(r.success).toBe(false);
  });

  it("caps a page at 40 sections", () => {
    expect(pageDocSchema.safeParse(doc(...Array.from({ length: 41 }, () => makeNode("section")))).success).toBe(false);
  });

  it("only allows the documented children", () => {
    expect(CHILDREN.root).toEqual(["section", "hero"]);
    expect(CHILDREN.columns).toEqual(["column"]);
    expect(CHILDREN.heading).toEqual([]);
  });
});

describe("no scripts", () => {
  it.each(["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<script>", "//evil.com", "vbscript:x"])("rejects link %s", (v) => {
    expect(safeHref.safeParse(v).success).toBe(false);
  });
  it.each(["/s/my-store", "#faq", "https://test.invalid", "mailto:help@test.invalid", ""])("accepts link %s", (v) => {
    expect(safeHref.safeParse(v).success).toBe(true);
  });
  it("only accepts uploads, product covers or https media", () => {
    expect(mediaSrc.safeParse("asset:abc123").success).toBe(true);
    expect(mediaSrc.safeParse("product:prod_01").success).toBe(true);
    expect(mediaSrc.safeParse("https://cdn.test.invalid/a.jpg").success).toBe(true);
    expect(mediaSrc.safeParse("http://insecure.test.invalid/a.jpg").success).toBe(false);
    expect(mediaSrc.safeParse("data:image/png;base64,AAAA").success).toBe(false);
  });
});

describe("tree helpers", () => {
  const leaf = makeNode("text", { text: "leaf" });
  const cols = makeNode("columns", {}, { children: [makeNode("column", {}, { children: [leaf] }), makeNode("column")] });
  const sec = makeNode("section", {}, { children: [cols] });
  const blocks = [makeNode("hero", { headline: "Hi" }), sec];

  it("finds and locates nodes", () => {
    expect(findNode(blocks, leaf.id)).toBe(leaf);
    expect(locate(blocks, sec.id)).toEqual({ parentId: "root", index: 1 });
    expect(locate(blocks, leaf.id)).toEqual({ parentId: cols.children[0].id, index: 0 });
    expect(sectionOf(blocks, leaf.id)).toBe(sec);
    expect(countNodes(blocks)).toBe(6);
  });

  it("clones with fresh ids all the way down", () => {
    const c = cloneNode(sec);
    const ids = (n: PageNode): string[] => [n.id, ...n.children.flatMap(ids)];
    expect(ids(c).some((id) => ids(sec).includes(id))).toBe(false);
    expect(c.children[0].children[0].children[0].props).toEqual(leaf.props);
  });
});
