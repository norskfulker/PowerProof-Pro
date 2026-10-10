import { describe, expect, it } from "vitest";
import { DB } from "@/tests/fixtures";
import type { Product } from "../types";
import { launchChecks, type LaunchInput } from "./launch-check";
import { makeNode, type PageNode } from "./schema";

const live = DB.products.filter((p) => p.status === "published");
const draft = DB.products.find((p) => p.status === "draft")!;
const base = `/s/${DB.store.slug}`;

function run(blocks: PageNode[], over: Partial<LaunchInput> = {}) {
  return launchChecks({
    doc: { version: 1, blocks },
    goingLive: false,
    store: { slug: DB.store.slug, name: DB.store.name, supportEmail: "help@shop.test", logo: { src: "https://x.test/logo.png" }, shipping: { zones: [{}] } },
    theme: DB.design.theme,
    products: DB.products,
    collections: DB.collections,
    pages: [{ slug: "launch", title: "Launch", published: true }, { slug: "secret", title: "Secret sale", published: false }],
    about: { name: "Asha", initials: "A", story: "I make planners.", location: "Pune" },
    faq: [{ id: "f1", q: "Refunds?", a: "Within 7 days." }],
    reviewCount: 3,
    label: (n) => n.type,
    ...over,
  });
}
const section = (...children: PageNode[]) => makeNode("section", { label: "Main" }, { children });
/** The kind of each issue: page issues end in the block's id */
const ids = (list: { id: string; nodeId?: string }[]) => list.map((i) => (i.nodeId ? i.id.slice(0, -(i.nodeId.length + 1)) : i.id));

describe("checks before publishing", () => {
  it("passes a finished page", () => {
    const page = [makeNode("hero", { headline: "Planners for busy people", image: "https://x.test/hero.jpg" }), section(makeNode("heading", { text: "Shop" }), makeNode("product_grid"), makeNode("button", { label: "All products", href: `${base}/products` }))];
    expect(run(page.map((n) => (n.type === "section" ? { ...n, children: n.children.map((c) => (c.type === "heading" ? { ...c, props: { ...c.props, text: "Best sellers" } } : c)) } : n)))).toEqual([]);
  });

  it("flags links buyers can't open: drafts, unpublished pages, missing collections and sections", () => {
    const found = run([
      section(
        makeNode("button", { label: "Draft", href: `${base}/${draft.slug}` }),
        makeNode("button", { label: "Secret", href: `${base}/p/secret` }),
        makeNode("button", { label: "Gone", href: `${base}/c/no-such-collection` }),
        makeNode("button", { label: "Jump", href: "#section-nope" }),
        makeNode("text", { text: "See [our launch](/s/" + DB.store.slug + "/p/launch) and [old page](/s/" + DB.store.slug + "/p/old)" })
      ),
    ]);
    expect(found.filter((i) => i.level === "fix").map((i) => i.title)).toEqual(["“Draft” goes nowhere", "“Secret” goes nowhere", "“Gone” goes nowhere", "“Jump” goes nowhere", "The link “old page” goes nowhere"]);
    expect(found.find((i) => i.title === "“Secret” goes nowhere")!.detail).toMatch(/Secret sale.*isn't published/);
    expect(found.every((i) => i.nodeId)).toBe(true);
  });

  it("flags products buyers can't buy, and empty product blocks", () => {
    const found = run([section(makeNode("product_card", { productId: draft.id }), makeNode("product_card", { productId: "deleted" }), makeNode("product_grid", { source: "manual", productIds: [draft.id] }))]);
    expect(ids(found)).toEqual(["product-draft", "product-gone", "grid-empty"]);
    expect(found.every((i) => i.level === "fix")).toBe(true);
  });

  it("notes what looks unfinished: empty pictures, starter text, a button to nowhere", () => {
    const found = run([section(makeNode("image"), makeNode("heading"), makeNode("button", { label: "Buy", href: "" }), makeNode("testimonials", { source: "reviews" }))], { reviewCount: 0 });
    expect(ids(found).sort()).toEqual(["button-nowhere", "image-none", "placeholder", "reviews-none"]);
    expect(found.every((i) => i.level === "check")).toBe(true);
  });

  it("skips blocks hidden on every device", () => {
    expect(run([section(makeNode("image", {}, { visibility: { mobile: false, desktop: false } }), makeNode("text", { text: "Hi" }))])).toEqual([]);
  });

  it("before going live, checks the store: products, files, shipping, logo, email, payouts, policies", () => {
    const noFile: Product = { ...live[0], id: "nf", title: "Empty download", fulfilment: "digital", files: [] };
    const shipped: Product = { ...live[0], id: "sh", title: "Mug", fulfilment: "physical", files: [], images: [] };
    const found = run([section(makeNode("text", { text: "Hello" }))], {
      goingLive: true,
      products: [noFile, shipped],
      store: { slug: DB.store.slug, name: DB.store.name, supportEmail: "", shipping: { zones: [] } },
      about: { name: "", initials: "", story: "", location: "" },
      payout: false,
      policies: { ...DB.storePages, edited: { refund: true, terms: false, privacy: false } },
    });
    expect(ids(found).sort()).toEqual(["no-shipping", "products-no-file", "products-no-picture", "no-logo", "no-email", "no-about", "policies-default", "no-payout"].sort());
    expect(found.find((i) => i.id === "policies-default")!.title).toBe("Your terms and privacy policy are still the default text");
    expect(found.slice(0, 2).every((i) => i.level === "fix")).toBe(true);
  });

  it("says when there's nothing to buy", () => {
    const found = run([section(makeNode("text", { text: "Hello" }))], { goingLive: true, products: [draft] });
    expect(found[0]).toMatchObject({ id: "no-products", level: "fix", href: "/catalog/products?status=draft" });
  });

  it("checks colours only when asked, and flags unreadable ones", () => {
    const theme = { ...DB.design.theme, schemes: [{ id: "s1", name: "Main", light: { background: "#ffffff", text: "#eeeeee", button: "#111111", buttonText: "#ffffff", border: "#dddddd" }, dark: { background: "#000000", text: "#ffffff", button: "#ffffff", buttonText: "#000000", border: "#333333" } }] };
    const page = [section(makeNode("text", { text: "Hello" }))];
    expect(run(page, { theme })).toEqual([]);
    expect(ids(run(page, { theme, checkColours: true }))).toEqual(["contrast-text-s1-light"]);
  });

  it("catches the starter text a new store comes with", () => {
    const page = [section(makeNode("about"), makeNode("faq", { source: "store" }))];
    const found = run(page, {
      goingLive: true,
      about: { name: "Asha", initials: "A", story: "Tell your story here.", location: "" },
      faq: [{ id: "f1", q: "Add your first question and answer.", a: "Buyers see it on your FAQ page." }],
      policies: { ...DB.storePages, terms: "Add your terms of sale here.", privacy: "Add your privacy policy here.", edited: { refund: false, terms: false, privacy: false } },
      payout: true,
    });
    expect(ids(found).sort()).toEqual(["about-empty", "faq-none", "no-about", "policies-default", "policies-stub"]);
    expect(found.find((i) => i.id === "policies-stub")!.title).toBe("Your terms and privacy policy are only placeholder text");
    expect(found.find((i) => i.id === "policies-default")!.title).toBe("Your refund policy is still the default text");
  });
});
