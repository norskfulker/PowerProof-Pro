import { describe, expect, it } from "vitest";
import { makeNode, type PageDoc } from "./pages/schema";
import { layoutOf, layoutVars, SITE_STYLES, siteStyleCss, styleById, styleDoc } from "./site-styles";

const page = (): PageDoc => ({ version: 1, blocks: [makeNode("hero", { headline: "Hi" }), makeNode("section", { label: "A" }, { children: [makeNode("text", { text: "Body" })] })] });

describe("site templates", () => {
  it("every type has a full layout, and no type is listed twice", () => {
    expect(new Set(SITE_STYLES.map((s) => s.id)).size).toBe(SITE_STYLES.length);
    for (const s of SITE_STYLES) expect(Object.keys(s.layout).sort()).toEqual(["dividers", "footer", "headings", "spacing", "width"]);
  });

  it("a store with no type is Blockwise", () => {
    expect(styleById(undefined).id).toBe("blocks");
    expect(layoutOf({})).toEqual(styleById("blocks").layout);
  });

  it("the creator's layout changes sit on top of the type's", () => {
    const l = layoutOf({ siteStyle: "freeflow", layout: { width: "narrow", spacing: undefined } });
    expect(l.width).toBe("narrow");
    expect(l.spacing).toBe("airy");
    expect(layoutVars({ siteStyle: "freeflow" })["--pp-display"]).toBe("1.45");
  });

  it("re-lays out sections for the type, leaving content alone", () => {
    const d = page();
    const free = styleDoc(d, "freeflow");
    expect(free.blocks.every((b) => b.layout.width === "full" && b.style.align === "left")).toBe(true);
    expect(free.blocks[1].children[0]).toEqual(d.blocks[1].children[0]);
    expect(styleDoc(d, "informational").blocks.every((b) => b.layout.width === "narrow")).toBe(true);
    // The original page isn't changed
    expect(d.blocks[0].layout.width).not.toBe("full");
  });

  it("dividers are drawn only when the layout asks for them", () => {
    expect(siteStyleCss({ siteStyle: "blocks" })).toContain("border-top");
    expect(siteStyleCss({ siteStyle: "blocks", layout: { dividers: false } })).not.toContain("border-top");
  });
});
