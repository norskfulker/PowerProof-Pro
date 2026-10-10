import { describe, expect, it } from "vitest";
import { DB } from "@/tests/fixtures";
import { contrast } from "../color";
import { defaultSchemes, schemeClass, schemeCss, schemesOf, schemeWarnings } from "../store-themes";
import type { StoreDesign } from "../types";
import { pageDocSchema, type PageDoc, type PageNode } from "./schema";
import { HOME_TEMPLATE, SECTION_PRESETS, homeDocFrom } from "./templates";

const design: StoreDesign = DB.design;
const valid = (d: PageDoc) => {
  const r = pageDocSchema.safeParse(d);
  if (!r.success) throw new Error(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return true;
};
const types = (n: PageNode): string[] => [n.type, ...n.children.flatMap(types)];

describe("the store home as a page", () => {
  it("keeps every showing section, in order, with its id, and is a valid page", () => {
    const doc = homeDocFrom(design, "my-store", ["p1", "p2", "p3"]);
    expect(valid(doc)).toBe(true);
    expect(HOME_TEMPLATE).toBe("home");
    const showing = design.sections.filter((s) => s.enabled && s.id !== "announcement").map((s) => s.id);
    // Sections with nothing to show (an empty HTML section) are left out; the rest keep their order and id
    expect(doc.blocks.map((b) => b.id).every((id) => showing.includes(id))).toBe(true);
    expect(doc.blocks.map((b) => b.id)).toEqual(showing.filter((id) => doc.blocks.some((b) => b.id === id)));
  });

  it("turns the hero into a hero block with its words, links and product pictures", () => {
    const doc = homeDocFrom({ ...design, hero: { ...design.hero, headline: "Hello", ctaLabel: "Shop", ctaTarget: "collection:kits", imageProductIds: ["a", "b", "c"], background: undefined }, theme: { ...design.theme, heroStyle: "left" } }, "my-store");
    const hero = doc.blocks.find((b) => b.type === "hero")!;
    expect(hero.props).toMatchObject({ headline: "Hello", ctaLabel: "Shop", ctaHref: "/s/my-store/c/kits", image: "product:a", moreImages: ["product:b", "product:c"], layout: "split" });
  });

  it("puts a hero background behind the words", () => {
    const doc = homeDocFrom({ ...design, hero: { ...design.hero, background: { kind: "image", src: "https://cdn.example/bg.jpg", alt: "", focal: { x: 50, y: 40 } } } }, "my-store");
    const hero = doc.blocks.find((b) => b.type === "hero")!;
    expect(hero.style.background).toMatchObject({ kind: "image", src: "https://cdn.example/bg.jpg" });
    expect(hero.style.overlay).toBeGreaterThanOrEqual(0.35);
  });

  it("converts the extra kinds: text, columns into cards, table, marquee and video", () => {
    const sections: StoreDesign["sections"] = [
      { id: "text-a", kind: "text", enabled: true, layout: { align: "center", tone: "soft", hideOn: "mobile" }, content: { text: { heading: "Hi", body: "Body", ctaLabel: "Go", ctaTarget: "page:faq" } } },
      { id: "cols-a", kind: "columns", enabled: true, title: "Why", content: { columns: [{ title: "A", body: "a" }, { title: "B", body: "b", ctaLabel: "More", ctaTarget: "url:https://example.com" }] } },
      { id: "table-a", kind: "table", enabled: true, content: { table: { rows: [["", "Pro"], ["Files", "All"]], header: true, striped: true } } },
      { id: "mq-a", kind: "marquee", enabled: true, content: { marquee: { mode: "text", items: [{ text: "Fast" }], speed: "fast", direction: "right", pauseOnHover: false } } },
      { id: "vid-a", kind: "video", enabled: true, content: { video: { src: "", url: "https://youtu.be/abcdefg" } } },
      { id: "img-off", kind: "image", enabled: false, content: { image: { src: "https://x.test/a.png", alt: "", aspect: "3:1", fit: "cover" } } },
    ];
    const doc = homeDocFrom({ ...design, sections }, "s");
    expect(valid(doc)).toBe(true);
    expect(doc.blocks.map((b) => b.id)).toEqual(["text-a", "cols-a", "table-a", "mq-a", "vid-a"]);
    const [text, cols, table, mq, vid] = doc.blocks;
    expect(text.style).toMatchObject({ align: "center", scheme: "scheme-3" });
    expect(text.visibility).toEqual({ mobile: false, desktop: true });
    expect(types(text)).toEqual(["section", "heading", "text", "button"]);
    expect(text.children[2].props).toMatchObject({ href: "/s/s/faq" });
    expect(types(cols)).toEqual(["section", "heading", "cards", "card", "card"]);
    expect(cols.children[1].children[1].props).toMatchObject({ ctaLabel: "More", ctaHref: "https://example.com" });
    expect(types(table)).toEqual(["section", "table"]);
    expect(mq.children[0].props).toMatchObject({ speed: "fast", direction: "right", pauseOnHover: false });
    expect(vid.children[0].props).toMatchObject({ src: "https://youtu.be/abcdefg" });
  });
});

describe("section presets", () => {
  it("each builds a valid top-level section, with or without products", () => {
    for (const products of [[], [{ id: "p1", title: "One" }]]) {
      const ctx = { slug: "s", products, collections: [{ slug: "kits", name: "Kits" }] };
      for (const p of SECTION_PRESETS) {
        const node = p.build(ctx);
        expect(valid({ version: 1, blocks: [node] }), p.id).toBe(true);
      }
    }
  });
  it("offers cards, tables, images, video and store sections", () => {
    const ids = SECTION_PRESETS.map((p) => p.id);
    for (const id of ["hero", "image-banner", "rich-text", "image-with-text", "cards", "table", "image", "video", "featured-products", "collection-list", "faq", "newsletter"]) expect(ids).toContain(id);
  });
});

describe("colour schemes", () => {
  it("starts with five readable schemes, light and dark", () => {
    const schemes = defaultSchemes(design.theme);
    expect(schemes).toHaveLength(5);
    for (const s of schemes) {
      for (const c of [s.light, s.dark]) {
        expect(contrast(c.text, c.background), `${s.name} text`).toBeGreaterThanOrEqual(4.5);
        expect(schemeWarnings({ ...c, buttonText: c.buttonText })).toEqual(schemeWarnings(c));
      }
    }
  });
  it("follows the brand colour until the creator edits them", () => {
    const branded = defaultSchemes({ ...design.theme, brand: "#AA2244" });
    expect(branded[0].light.button).toBe("#AA2244");
    const own = [{ ...branded[0], name: "Mine" }];
    expect(schemesOf({ ...design.theme, schemes: own })).toEqual(own);
  });
  it("writes CSS per scheme for both modes, and only for safe ids", () => {
    const css = schemeCss({ ...design.theme, schemes: [...defaultSchemes(design.theme), { ...defaultSchemes(design.theme)[0], id: "bad id}" }] });
    expect(css).toContain('[data-store-mode="light"] .pp-scheme-scheme-1{');
    expect(css).toContain('[data-store-mode="dark"] .pp-scheme-scheme-1{');
    expect(css).toContain("--primary:");
    expect(css).not.toContain("bad id");
    expect(schemeClass("scheme-2")).toBe("pp-scheme-scheme-2");
    expect(schemeClass("x;y")).toBeUndefined();
    expect(schemeClass("")).toBeUndefined();
  });
  it("warns when text is hard to read", () => {
    expect(schemeWarnings({ background: "#FFFFFF", text: "#EEEEEE", button: "#000000", buttonText: "#FFFFFF", border: "#DDDDDD" })).toHaveLength(1);
  });
});
