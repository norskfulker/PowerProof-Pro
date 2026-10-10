import { describe, expect, it } from "vitest";
import { createEditorStore, insertionPoint } from "./editor-store";
import { DB } from "@/tests/fixtures";
import { findNode, locate, makeNode, pageDocSchema, type PageDoc } from "./schema";

const DB_DESIGN = DB.design;

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

describe("store-wide settings beside the page", () => {
  const site = { design: DB_DESIGN, logo: undefined };
  it("changes them with undo and redo, together with the page", () => {
    const store = createEditorStore({ version: 1, blocks: [] }, site);
    const s = () => store.getState();
    s().updateSite((x) => ({ ...x, design: { ...x.design, theme: { ...x.design.theme, corners: "round" } } }));
    expect(s().site?.design.theme.corners).toBe("round");
    expect(s().rev).toBe(1);
    s().insertSection(makeNode("section", {}, { id: "sx" }));
    s().undo();
    expect(s().doc.blocks).toHaveLength(0);
    expect(s().site?.design.theme.corners).toBe("round");
    s().undo();
    expect(s().site?.design.theme.corners).not.toBe("round");
    s().redo();
    expect(s().site?.design.theme.corners).toBe("round");
  });
  it("keeps a header or footer selected through undo", () => {
    const store = createEditorStore({ version: 1, blocks: [] }, site);
    store.getState().select("@header");
    store.getState().updateSite((x) => x);
    store.getState().undo();
    expect(store.getState().selectedId).toBe("@header");
  });
});

describe("sections from presets", () => {
  it("go where asked and are selected", () => {
    const { s } = setup();
    const id = s().insertSection(makeNode("section", {}, { id: "new" }), 1);
    expect(id).toBe("new");
    expect(s().doc.blocks.map((b) => b.id)).toEqual(["hero", "new", "s1"]);
    expect(s().selectedId).toBe("new");
  });
  it("only at the top level", () => {
    const { s } = setup();
    expect(s().insertSection(makeNode("text", {}))).toBeUndefined();
  });
});

describe("cards", () => {
  it("start with three cards; another card goes after the selected one; removing the last removes the block", () => {
    const { s } = setup();
    s().select("s1");
    const cardsId = s().insert("cards")!;
    const cards = findNode(s().doc.blocks, cardsId)!;
    expect(cards.children).toHaveLength(3);
    s().select(cards.children[0].id);
    const added = s().insert("card")!;
    expect(findNode(s().doc.blocks, cardsId)!.children.map((c) => c.id).indexOf(added)).toBe(1);
    expect(valid(s().doc)).toBe(true);
    for (const c of [...findNode(s().doc.blocks, cardsId)!.children]) s().remove(c.id);
    expect(findNode(s().doc.blocks, cardsId)).toBeUndefined();
  });
  it("can't go straight into a section without its wrapper", () => {
    const { s } = setup();
    expect(s().insert("card", { parentId: "s1" })).toBeUndefined();
  });
});
