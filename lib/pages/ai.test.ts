import { describe, expect, it } from "vitest";
import { DB } from "@/tests/fixtures";
import { contrast } from "../color";
import { AiInputError, aiBriefSchema, aiHeroToNode, aiSectionToNode, aiThemeToPatch, aiToolSchemas, finishAiDoc, type AiStoreFacts } from "./ai";
import { createEditorStore } from "./editor-store";
import { findNode, makeNode, pageDocSchema } from "./schema";

const facts: AiStoreFacts = {
  slug: "my-store",
  products: [{ id: "p1", slug: "ui-kit" }, { id: "p2", slug: "icons" }],
  collections: [{ slug: "kits" }],
  sectionIds: (n) => `run-s${n}`,
  hasReviews: false,
  media: [
    { ref: "pic:1", kind: "image", src: "product:p1" },
    { ref: "pic:2", kind: "image", src: "https://cdn.test/studio.jpg" },
    { ref: "vid:1", kind: "video", src: "https://cdn.test/clip.mp4", poster: "product:p1" },
  ],
};
const schemes = ["scheme-1", "scheme-2", "scheme-3", "scheme-4", "scheme-5"];
const none = { kind: "none", picture: "", video: "", color: "", color2: "", overlay: 0, text: "auto" } as const;
const look = { scheme: "scheme-3", fill: "content", align: "center", width: "wide", space: "md", height: "auto", gap: "md", background: none } as const;
const section = (blocks: unknown[]) => ({ label: "Test", ...look, blocks });

describe("AI sections become checked page blocks", () => {
  it("builds headings, text, buttons, cards and image-with-text, with store links", () => {
    const node = aiSectionToNode(
      section([
        { type: "heading", text: "Why it works", size: "md", linkLabel: "View all", linkTarget: "products", align: "" },
        { type: "text", text: "Short and **useful**.", size: "md", align: "" },
        { type: "button", label: "Get it", target: "product:ui-kit", style: "primary", size: "lg", align: "center" },
        { type: "cards", columns: 3, look: "card", shape: "4:3", align: "center", cards: [{ icon: "Truck", picture: "pic:1", title: "Fast", text: "Quick", linkLabel: "See", linkTarget: "collection:kits" }] },
        { type: "image_with_text", picture: "product:p2", video: "", alt: "Icons", shape: "4:3", side: "right", ratio: "equal", eyebrow: "", heading: "Icons", text: "Many", buttonLabel: "Shop", buttonTarget: "section:2" },
      ]),
      "run-s1",
      facts,
      schemes
    );
    expect(node.id).toBe("run-s1");
    expect(node.style.scheme).toBe("scheme-3");
    expect(node.layout.fill).toBe("content");
    expect(node.children.map((c) => c.type)).toEqual(["heading", "text", "button", "cards", "columns"]);
    expect(node.children[0].props).toMatchObject({ linkHref: "/s/my-store/products" });
    expect(node.children[2].props).toMatchObject({ href: "/s/my-store/ui-kit" });
    expect(node.children[2].style.selfAlign).toBe("center");
    expect(node.children[4].props).toMatchObject({ valign: "center" });
    expect(node.children[3].children[0].props).toMatchObject({ icon: "Truck", image: "product:p1", ctaHref: "/s/my-store/c/kits" });
    // Picture on the right: words first
    expect(node.children[4].children[0].children[0].type).toBe("heading");
    expect(findNode([node], node.children[4].children[0].children[2].id)?.props).toMatchObject({ href: "#section-run-s2" });
    expect(pageDocSchema.safeParse({ version: 1, blocks: [node] }).success).toBe(true);
  });

  it("refuses made-up products, pictures, collections and links, with a reason the AI can fix", () => {
    const bad = [
      [{ type: "product_card", productId: "nope" }, /no product/],
      [{ type: "image", picture: "https://evil.test/x.png", alt: "", shape: "4:3", caption: "", align: "" }, /isn't in the pictures list/],
      [{ type: "image", picture: "pic:9", alt: "", shape: "4:3", caption: "", align: "" }, /isn't in the pictures list/],
      [{ type: "video", video: "https://evil.test/v.mp4", poster: "", shape: "16:9", autoplay: false, caption: "", align: "" }, /isn't a video/],
      [{ type: "button", label: "Go", target: "collection:ghost", style: "primary", size: "md", align: "" }, /no collection/],
      [{ type: "button", label: "Go", target: "javascript:alert(1)", style: "primary", size: "md", align: "" }, /isn't a place/],
    ] as const;
    for (const [block, why] of bad) {
      expect(() => aiSectionToNode(section([block]), "s", facts, schemes)).toThrow(AiInputError);
      expect(() => aiSectionToNode(section([block]), "s", facts, schemes)).toThrow(why);
    }
  });

  it("never shows reviews a store doesn't have", () => {
    expect(() => aiSectionToNode(section([{ type: "reviews", limit: 3 }]), "s", facts, schemes)).toThrow(/nothing that can show/);
    const withReviews = aiSectionToNode(section([{ type: "reviews", limit: 9 }]), "s", { ...facts, hasReviews: true }, schemes);
    expect(withReviews.children[0].props).toMatchObject({ source: "reviews", limit: 6 });
  });

  it("drops an unknown scheme, and keeps a lead form reachable by email", () => {
    const node = aiSectionToNode({ ...section([{ type: "lead_form", heading: "Free guide", body: "", fields: [{ label: "Name", type: "text", required: true }], buttonLabel: "Send", successMessage: "" }]), scheme: "made-up" }, "s", facts, schemes);
    expect(node.style.scheme).toBe("");
    const fields = (node.children[0].props as { fields: { type: string }[] }).fields;
    expect(fields.some((f) => f.type === "email")).toBe(true);
  });

  it("uses the store's pictures and videos, and YouTube links from the brief", () => {
    const node = aiSectionToNode(
      section([
        { type: "image", picture: "pic:2", alt: "Studio", shape: "3:4", caption: "", align: "" },
        { type: "video", video: "vid:1", poster: "", shape: "16:9", autoplay: true, caption: "", align: "" },
        { type: "video", video: "https://www.youtube.com/watch?v=abc123", poster: "pic:2", shape: "16:9", autoplay: true, caption: "", align: "" },
        { type: "gallery", pictures: ["pic:1", "pic:2"], columns: 2 },
        { type: "image_with_text", picture: "", video: "vid:1", alt: "", shape: "16:9", side: "left", ratio: "media-wider", eyebrow: "Watch", heading: "See it", text: "", buttonLabel: "", buttonTarget: "" },
      ]),
      "s",
      facts,
      schemes
    );
    const [img, vid, yt, gallery, iwt] = node.children;
    expect(img.props).toMatchObject({ src: "https://cdn.test/studio.jpg", aspect: "3:4" });
    expect(vid.props).toMatchObject({ src: "https://cdn.test/clip.mp4", poster: "product:p1", autoplay: true });
    // Embeds don't autoplay
    expect(yt.props).toMatchObject({ src: "https://www.youtube.com/watch?v=abc123", poster: "https://cdn.test/studio.jpg", autoplay: false });
    expect((gallery.props as { images: { src: string }[] }).images.map((i) => i.src)).toEqual(["product:p1", "https://cdn.test/studio.jpg"]);
    expect(iwt.props).toMatchObject({ ratio: "2:1", valign: "center" });
    expect(iwt.children[0].children[0].type).toBe("video");
  });

  it("puts pictures and colours behind sections, always readable", () => {
    const pic = aiSectionToNode({ ...section([{ type: "heading", text: "Big", size: "xl", linkLabel: "", linkTarget: "", align: "" }]), fill: "full", height: "lg", background: { ...none, kind: "picture", picture: "pic:2", overlay: 10, text: "auto" } }, "s", facts, schemes);
    expect(pic.style.background).toMatchObject({ kind: "image", src: "https://cdn.test/studio.jpg" });
    expect(pic.style.overlay).toBeGreaterThanOrEqual(0.35);
    expect(pic.style.tone).toBe("light");
    expect(pic.layout.minHeight).toBe("lg");
    const grad = aiSectionToNode({ ...section([{ type: "text", text: "Hi", size: "md", align: "" }]), background: { ...none, kind: "gradient", color: "#0E4A5C", color2: "#123456" } }, "s", facts, schemes);
    expect(grad.style.background).toEqual({ kind: "gradient", from: "#0E4A5C", to: "#123456", angle: 135 });
    expect(() => aiSectionToNode({ ...section([{ type: "divider" }]), background: { ...none, kind: "video", video: "https://www.youtube.com/watch?v=x" } }, "s", facts, schemes)).toThrow(/uploaded video/);
  });

  it("lays out columns, and gives grids room and long centred text a left edge", () => {
    const cols = aiSectionToNode(
      section([{ type: "columns", ratio: "2:1", columns: [{ align: "left", blocks: [{ type: "heading", text: "A", size: "md", linkLabel: "", linkTarget: "", align: "" }] }, { align: "center", blocks: [{ type: "button", label: "Go", target: "products", style: "primary", size: "md", align: "" }] }] }]),
      "s",
      facts,
      schemes
    );
    expect(cols.children[0].props).toMatchObject({ ratio: "2:1" });
    expect(cols.children[0].children[1].style.align).toBe("center");
    const big = aiSectionToNode(section([{ type: "columns", ratio: "equal", columns: [0, 1].map(() => ({ align: "left" as const, blocks: [{ type: "heading" as const, text: "A", size: "xl" as const, linkLabel: "", linkTarget: "", align: "" as const }] })) }]), "s", facts, schemes);
    expect(big.children[0].children[0].children[0].props).toMatchObject({ size: "md" });
    const c3 = { icon: "Truck", picture: "", title: "A", text: "", linkLabel: "", linkTarget: "" };
    const grid = aiSectionToNode({ ...section([{ type: "cards", columns: 3, look: "card", shape: "4:3", align: "left", cards: [c3, c3, c3] }]), width: "narrow" }, "s", facts, schemes);
    expect(grid.layout.width).toBe("wide");
    // One product shows as a product card, two in two columns; cards fit their count
    const one = aiSectionToNode(section([{ type: "product_grid", show: "picked", productIds: ["p2"], limit: 6, columns: 3 }]), "s", facts, schemes);
    expect(one.children[0]).toMatchObject({ type: "product_card", props: { productId: "p2" } });
    expect(one.layout.width).toBe("normal");
    const two = aiSectionToNode(section([{ type: "product_grid", show: "all", productIds: [], limit: 6, columns: 4 }]), "s", facts, schemes);
    expect(two.children[0].props).toMatchObject({ columns: 2 });
    const card = { icon: "Truck", picture: "", title: "A", text: "", linkLabel: "", linkTarget: "" };
    const cards = aiSectionToNode(section([{ type: "cards", columns: 4, look: "card", shape: "4:3", align: "left", cards: [card, card] }]), "s", facts, schemes);
    expect(cards.children[0].props).toMatchObject({ columns: 2 });
    // A heading with a "View all" link lines the section up on the left
    const linked = aiSectionToNode(section([{ type: "heading", text: "Shop", size: "md", linkLabel: "View all", linkTarget: "products", align: "" }]), "s", facts, schemes);
    expect(linked.style.align).toBe("left");
    const long = aiSectionToNode(section([{ type: "text", text: "x".repeat(700), size: "md", align: "" }]), "s", facts, schemes);
    expect(long.layout.width).toBe("normal");
    expect(long.children[0].style.selfAlign).toBe("left");
  });

  it("builds a hero with product pictures and two buttons", () => {
    const hero = aiHeroToNode({ eyebrow: "New", headline: "Design faster", subtext: "A kit", buttonLabel: "Get it", buttonTarget: "products", secondButtonLabel: "Learn", secondButtonTarget: "about", pictures: ["pic:1", "product:p2"], layout: "split", ...look }, "run-s1", facts, schemes);
    expect(hero.type).toBe("hero");
    expect(hero.props).toMatchObject({ image: "product:p1", moreImages: ["product:p2"], ctaHref: "/s/my-store/products", cta2Href: "/s/my-store/about", layout: "split" });
    // A picture behind the words isn't repeated beside them, and the hero gets taller
    const over = aiHeroToNode({ ...look, eyebrow: "", headline: "Studio", subtext: "", buttonLabel: "", buttonTarget: "", secondButtonLabel: "", secondButtonTarget: "", pictures: ["pic:2"], layout: "split", background: { ...none, kind: "picture", picture: "pic:2", overlay: 50, text: "light" } }, "h", facts, schemes);
    expect(over.props).toMatchObject({ image: "", layout: "left" });
    expect(over.layout.minHeight).toBe("lg");
  });

  it("fixes theme colours that would be hard to read", () => {
    const colors = { background: "#FFFFFF", text: "#F0F0F0", button: "#111111", buttonText: "#222222", border: "#DDDDDD" };
    const patch = aiThemeToPatch({ palette: "ocean", brand: "#0E4A5C", accent: "#E0A43B", fonts: "editorial", corners: "round", mode: "light", schemes: [{ id: "scheme-1", name: "Page", light: colors, dark: colors }, { id: "scheme-2", name: "Card", light: colors, dark: colors }, { id: "scheme-3", name: "Ink", light: colors, dark: colors }], announcement: "Free updates", seoTitle: "Kits", seoDescription: "Kits for designers" }, DB.design.theme);
    expect(patch.theme).toMatchObject({ palette: "ocean", brand: "#0E4A5C", fonts: "editorial", corners: "round" });
    for (const s of patch.theme.schemes!) {
      expect(contrast(s.light.text, s.light.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(s.light.buttonText, s.light.button)).toBeGreaterThanOrEqual(4.5);
    }
    expect(patch.announcement).toBe("Free updates");
  });

  it("points links to sections that never came at the products instead", () => {
    const btn = makeNode("button", { label: "Jump", href: "#section-run-s9" });
    const keep = makeNode("button", { label: "Up", href: "#section-run-s1" });
    const doc = finishAiDoc({ version: 1, blocks: [makeNode("section", {}, { id: "run-s1", children: [btn, keep] })] }, "my-store");
    expect(doc.blocks[0].children.map((c) => (c.props as { href: string }).href)).toEqual(["/s/my-store/products", "#section-run-s1"]);
  });
});

describe("the tools the AI gets", () => {
  it("are closed objects without keywords strict tools can't take", () => {
    const text = JSON.stringify(aiToolSchemas());
    for (const k of ["maxLength", "minLength", "minimum", "maximum", "maxItems", "$schema", "pattern"]) expect(text).not.toContain(`"${k}"`);
    const open: string[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      if (o.type === "object" && o.additionalProperties !== false) open.push(JSON.stringify(o).slice(0, 60));
      Object.values(o).forEach(walk);
    };
    walk(aiToolSchemas());
    expect(open).toEqual([]);
  });
  it("only accepts a real brief", () => {
    expect(aiBriefSchema.safeParse({ pageType: "sale", description: "short" }).success).toBe(false);
    expect(aiBriefSchema.parse({ pageType: "sale", description: "A Diwali sale on every kit" })).toMatchObject({ language: "English", theme: true, mode: "replace" });
  });
});

describe("an AI build in the editor", () => {
  it("shows outside history, then keeps as one undo step or goes back", () => {
    const start = { version: 1 as const, blocks: [makeNode("section", {}, { id: "old" })] };
    const store = createEditorStore(start, { design: DB.design });
    const s = () => store.getState();
    s().beginAi();
    s().showAi({ version: 1, blocks: [makeNode("section", {}, { id: "a" })] });
    s().showAi({ version: 1, blocks: [makeNode("section", {}, { id: "a" }), makeNode("section", {}, { id: "b" })] });
    expect(s().rev).toBe(0);
    s().endAi(false);
    expect(s().doc.blocks.map((b) => b.id)).toEqual(["old"]);

    s().beginAi();
    s().showAi({ version: 1, blocks: [makeNode("section", {}, { id: "new" })] }, { design: { ...DB.design, theme: { ...DB.design.theme, corners: "round" } } });
    s().endAi(true);
    expect(s().rev).toBe(1);
    expect(s().site?.design.theme.corners).toBe("round");
    s().undo();
    expect(s().doc.blocks.map((b) => b.id)).toEqual(["old"]);
    expect(s().site?.design.theme.corners).not.toBe("round");
  });
});
