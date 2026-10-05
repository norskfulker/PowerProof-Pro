import { describe, expect, it } from "vitest";
import { createEditorStore, insertionPoint } from "./editor-store";
import { findNode, locate, makeNode, pageDocSchema, type PageDoc } from "./schema";

function setup() {
  const text = makeNode("text", { text: "one" }, { id: "t1" });
  const head = makeNode("heading", { text: "Title" }, { id: "h1" });
  const sec = makeNode("section", {}, { id: "s1", children: [head, text] });
  const hero = makeNode("hero", { headline: "Hi" }, { id: "hero" });
  const doc: PageDoc = { version: 1, blocks: [hero, sec] };
  const store = createEditorStore(doc);
  return { store, s: () => store.getState() };
}

const valid = (d: PageDoc) => pageDocSchema.safeParse(d).success;

describe("insert", () => {
  it("wraps content in a new section when nothing is selected", () => {
    const { s } = setup();
    const id = s().insert("text")!;
    const last = s().doc.blocks.at(-1)!;
    expect(last.type).toBe("section");
    expect(last.children[0].id).toBe(id);
    expect(s().selectedId).toBe(id);
    expect(valid(s().doc)).toBe(true);
  });

  it("puts content right after the selected block", () => {
    const { s } = setup();
    s().select("h1");
    const id = s().insert("button")!;
    expect(locate(s().doc.blocks, id)).toEqual({ parentId: "s1", index: 1 });
  });

  it("appends inside a selected section", () => {
    const { s } = setup();
    s().select("s1");
    const id = s().insert("divider")!;
    expect(locate(s().doc.blocks, id)).toEqual({ parentId: "s1", index: 2 });
  });

  it("adds sections at the top level after the selected section", () => {
    const { s } = setup();
    s().select("hero");
    const id = s().insert("section")!;
    expect(locate(s().doc.blocks, id)).toEqual({ parentId: "root", index: 1 });
  });

  it("creates columns with two columns and stays valid", () => {
    const { s } = setup();
    s().select("t1");
    const id = s().insert("columns")!;
    expect(findNode(s().doc.blocks, id)!.children).toHaveLength(2);
    expect(valid(s().doc)).toBe(true);
  });

  it("never puts a section inside a section", () => {
    const { s } = setup();
    expect(insertionPoint(s().doc.blocks, "section", "t1").parentId).toBe("root");
  });

  it("stops at 40 top-level sections", () => {
    const { s } = setup();
    for (let i = 0; i < 45; i++) s().insert("section");
    expect(s().doc.blocks.length).toBe(40);
  });
});

describe("undo and redo", () => {
  it("undoes and redoes edits", () => {
    const { s } = setup();
    s().updateProps("h1", { text: "New" });
    expect(findNode(s().doc.blocks, "h1")!.props).toMatchObject({ text: "New" });
    s().undo();
    expect(findNode(s().doc.blocks, "h1")!.props).toMatchObject({ text: "Title" });
    s().redo();
    expect(findNode(s().doc.blocks, "h1")!.props).toMatchObject({ text: "New" });
  });

  it("coalesces typing in one field into one step", () => {
    const { s } = setup();
    for (const t of ["N", "Ne", "New"]) s().updateProps("h1", { text: t }, "text");
    expect(s().past).toHaveLength(1);
    s().undo();
    expect(findNode(s().doc.blocks, "h1")!.props).toMatchObject({ text: "Title" });
  });

  it("clears redo after a new edit", () => {
    const { s } = setup();
    s().updateProps("h1", { text: "A" });
    s().undo();
    s().updateProps("h1", { text: "B" });
    expect(s().future).toEqual([]);
  });

  it("selection alone isn't an undo step", () => {
    const { s } = setup();
    s().select("t1");
    expect(s().past).toEqual([]);
  });

  it("tracks unsaved changes with rev and savedRev", () => {
    const { s } = setup();
    s().updateProps("h1", { text: "x" });
    expect(s().rev).toBeGreaterThan(s().savedRev);
    s().markSaved(s().rev);
    expect(s().rev).toBe(s().savedRev);
  });
});

describe("move, duplicate, remove", () => {
  it("moves up and down within a parent", () => {
    const { s } = setup();
    expect(s().moveBy("t1", -1)).toBe(true);
    expect(s().doc.blocks[1].children.map((c) => c.id)).toEqual(["t1", "h1"]);
    expect(s().moveBy("t1", -1)).toBe(false);
  });

  it("moves between parents through moveNode, respecting the rules", () => {
    const { s } = setup();
    s().select("s1");
    const secId = s().insert("section")!;
    expect(s().moveNode("t1", secId, 0)).toBe(true);
    expect(locate(s().doc.blocks, "t1")).toEqual({ parentId: secId, index: 0 });
    expect(s().moveNode("s1", secId, 0)).toBe(false);
    expect(s().moveNode("hero", "s1", 0)).toBe(false);
    expect(valid(s().doc)).toBe(true);
  });

  it("refuses to move a node into itself", () => {
    const { s } = setup();
    expect(s().moveNode("s1", "s1", 0)).toBe(false);
  });

  it("duplicates with fresh ids right after the original", () => {
    const { s } = setup();
    const copy = s().duplicate("s1")!;
    expect(copy).not.toBe("s1");
    expect(locate(s().doc.blocks, copy)).toEqual({ parentId: "root", index: 2 });
    expect(valid(s().doc)).toBe(true);
  });

  it("removes and selects a neighbour", () => {
    const { s } = setup();
    s().select("h1");
    s().remove("h1");
    expect(findNode(s().doc.blocks, "h1")).toBeUndefined();
    expect(s().selectedId).toBe("t1");
  });

  it("removing one of two columns removes the columns block", () => {
    const { s } = setup();
    s().select("t1");
    const cols = s().insert("columns")!;
    const col = findNode(s().doc.blocks, cols)!.children[0].id;
    s().remove(col);
    expect(findNode(s().doc.blocks, cols)).toBeUndefined();
    expect(valid(s().doc)).toBe(true);
  });
});

describe("style, layout and visibility", () => {
  it("updates each part of a node", () => {
    const { s } = setup();
    s().updateStyle("s1", { align: "center", background: { kind: "solid", color: "#0F3D33" } });
    s().updateLayout("s1", { paddingY: "xl" });
    s().updateVisibility("s1", { mobile: false });
    const n = findNode(s().doc.blocks, "s1")!;
    expect(n.style.align).toBe("center");
    expect(n.layout.paddingY).toBe("xl");
    expect(n.visibility).toEqual({ mobile: false, desktop: true });
    expect(valid(s().doc)).toBe(true);
  });
});
