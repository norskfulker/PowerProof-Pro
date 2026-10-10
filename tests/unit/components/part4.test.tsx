import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageRenderer, autoTone, contrastWarning, embedUrl } from "@/components/page-builder/renderer";
import { AddBlockMenu } from "@/components/page-builder/add-block-menu";
import { DevicePreviewSwitch } from "@/components/page-builder/device-preview-switch";
import { EditorProvider, useEditor } from "@/components/page-builder/editor-context";
import { setAtPath } from "@/components/page-builder/canvas";
import { editTarget } from "@/components/page-builder/link-prompt";
import { contrast } from "@/lib/color";
import { LayersPanel } from "@/components/page-builder/layers-panel";
import { SettingsPanel } from "@/components/page-builder/settings-panel";
import { TableEditor } from "@/components/page-builder/controls";
import { DealCard, GiftPicker, RuleSummaryChip, SavingsMeter } from "@/components/pp/deal-parts";
import { DealPanel } from "@/components/pp/deal-panel";
import { DealPreview } from "@/components/pp/deal-preview";
import { draftFromRule, emptyDraft, inputFromDraft, specFromDraft, validateStep, DealRuleWizard, type WizardDraft } from "@/components/pp/deal-rule-wizard";
import { ResultRow } from "@/components/search/result-row";
import type { RenderContext } from "@/lib/api";
import type { CheckoutDeals } from "@/lib/types";
import { fromMajor, money } from "@/lib/money";
import { dealRuleSchema } from "@/lib/pricing/deal-rule-schema";
import { BLOCK_TYPES, makeNode, styleSchema, type PageDoc } from "@/lib/pages/schema";
import { PAGE_TEMPLATES } from "@/lib/pages/templates";
import { priceInfo, ratingSummary } from "@/lib/pricing";
import { DB, NOW } from "@/tests/fixtures";

const live = DB.products.filter((p) => p.status === "published");
const PRODUCTS = live.map((p) => ({ ...p, info: priceInfo(p, DB.deals, NOW), rating: ratingSummary([]) }));
const CONTEXT: RenderContext = { store: DB.store, theme: DB.design.theme, products: PRODUCTS, collections: DB.collections, reviews: [{ id: "r", title: "Great", body: "Loved it", author: "Asha K.", rating: 5 }], bundles: [], about: DB.design.about, faq: [{ id: "f1", q: "How do I get it?", a: "Instantly." }], rating: ratingSummary([]) };
const RULES = DB.dealRules;
const NOW_ISO = new Date(NOW).toISOString();

describe("deal parts", () => {
  it("summarises every rule type", () => {
    for (const r of RULES) {
      const { unmount } = render(<RuleSummaryChip rule={r} titleOf={() => "X"} />);
      expect(document.body.textContent?.length).toBeGreaterThan(5);
      unmount();
    }
  });

  it("exposes savings as a meter", () => {
    render(<SavingsMeter saved={fromMajor(100)} potential={fromMajor(100)} currency="INR" />);
    const meter = screen.getByRole("meter", { name: "Savings" });
    expect(meter).toHaveAttribute("aria-valuenow", "50");
    expect(meter.getAttribute("aria-valuetext")).toMatch(/saving ₹100/);
  });

  it("adds an offer", async () => {
    const onAdd = vi.fn();
    render(<ul><DealCard offer={{ ruleId: "r", ruleName: "R", kind: "add", addProductIds: [live[1].id], saving: fromMajor(50), extraCost: fromMajor(100) }} products={live} currency="INR" onAdd={onAdd} /></ul>);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`Add ${live[1].title}`) }));
    expect(onAdd).toHaveBeenCalledWith([live[1].id]);
  });

  it("picks a gift, showing it as free", async () => {
    const onPick = vi.fn();
    render(<GiftPicker title="Pick one" options={live.slice(0, 2)} currency="INR" onPick={onPick} />);
    expect(screen.getAllByText("Free")).toHaveLength(2);
    await userEvent.click(screen.getByRole("radio", { name: `${live[1].title}, free` }));
    expect(onPick).toHaveBeenCalledWith(live[1].id);
  });
});

describe("DealPanel", () => {
  const deals: CheckoutDeals = {
    offers: [0, 1, 2, 3].map((i) => ({ ruleId: RULES[0].id, ruleName: "R", kind: "add" as const, addProductIds: [live[i + 1].id], saving: fromMajor(100 - i), extraCost: fromMajor(10) })),
    pendingChoices: [],
    saving: money(0),
    rules: RULES,
    products: PRODUCTS,
    skipped: false,
  };
  const noop = () => {};

  it("shows three offers and the rest behind See more", async () => {
    render(<DealPanel deals={deals} items={[]} added={[]} currency="INR" onAdd={noop} onRemove={noop} onGift={noop} onSkip={noop} />);
    const list = screen.getByRole("list", { name: "Deals you can add" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "See 1 more" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  it("skips in one click and can come back", async () => {
    const onSkip = vi.fn();
    const { rerender } = render(<DealPanel deals={deals} items={[]} added={[]} currency="INR" onAdd={noop} onRemove={noop} onGift={noop} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(onSkip).toHaveBeenCalledWith(true);
    rerender(<DealPanel deals={{ ...deals, skipped: true }} items={[]} added={[]} currency="INR" onAdd={noop} onRemove={noop} onGift={noop} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole("button", { name: "Show deals" }));
    expect(onSkip).toHaveBeenCalledWith(false);
  });

  it("lists items the buyer added, each removable", async () => {
    const onRemove = vi.fn();
    render(<DealPanel deals={deals} items={[]} added={[live[1].id]} currency="INR" onAdd={noop} onRemove={onRemove} onGift={noop} onSkip={noop} />);
    await userEvent.click(screen.getByRole("button", { name: `Remove ${live[1].title}` }));
    expect(onRemove).toHaveBeenCalledWith(live[1].id);
  });

  it("renders nothing when there's nothing to offer", () => {
    const { container } = render(<DealPanel deals={{ ...deals, offers: [] }} items={[]} added={[]} currency="INR" onAdd={noop} onRemove={noop} onGift={noop} onSkip={noop} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DealPreview", () => {
  it("runs the real engine in test mode", async () => {
    render(<DealPreview rules={RULES} products={DB.products} storeDeals={DB.deals} now={NOW} />);
    expect(screen.getByText("Test mode")).toBeInTheDocument();
    expect(screen.getByText("Buyer pays")).toBeInTheDocument();
  });
});

describe("deal rule wizard", () => {
  it("round-trips every seeded rule through the draft", () => {
    for (const sc of [DB, ...DB.otherStores]) {
      for (const r of sc.dealRules) {
        const back = specFromDraft(draftFromRule(r));
        expect(back.kind).toBe(r.kind);
        expect(dealRuleSchema.safeParse(inputFromDraft(draftFromRule(r))).success).toBe(true);
      }
    }
  });

  it("validates each step in plain words", () => {
    const d = emptyDraft();
    expect(validateStep(0, d).products).toMatch(/at least two products/);
    expect(validateStep(1, { ...d, percent: "95" }).percent).toMatch(/1 to 90/);
    expect(validateStep(2, d).name).toMatch(/name/i);
    expect(validateStep(0, { ...d, when: "spend", minSpend: "" }).minSpend).toMatch(/₹1/);
  });

  it("moves through the three steps", async () => {
    const onSave = vi.fn();
    function Harness() {
      const [draft, setDraft] = useState<WizardDraft>({ ...emptyDraft(), when: "spend", then: "percent", minSpend: "999", name: "Big" });
      return <DealRuleWizard draft={draft} onChange={setDraft} products={DB.products} onSave={onSave} onCancel={() => {}} />;
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save deal path" }));
    expect(onSave).toHaveBeenCalled();
  });
});

describe("search result row", () => {
  it("shows masked contact with a reveal button and actions", async () => {
    const onReveal = vi.fn();
    const onAction = vi.fn();
    render(<ResultRow result={{ type: "order", id: "o", title: "PP-1", href: "/x", email: "na••••@gmail.com", masked: true, actions: ["open", "copy", "refund"] }} revealed={{}} onReveal={onReveal} onAction={onAction} />);
    expect(screen.getByText("na••••@gmail.com")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reveal email for PP-1" }));
    expect(onReveal).toHaveBeenCalledWith("email");
    await userEvent.click(screen.getByRole("button", { name: "Refund: PP-1" }));
    expect(onAction).toHaveBeenCalledWith("refund");
  });

  it("shows the revealed value instead of the mask", () => {
    render(<ResultRow result={{ type: "order", id: "o", title: "PP-1", href: "/x", email: "na••••@gmail.com", masked: true, actions: ["open"] }} revealed={{ "order:o:email": "name@gmail.com" }} onAction={() => {}} />);
    expect(screen.getByText("name@gmail.com")).toBeInTheDocument();
  });
});

describe("page renderer", () => {
  it.each(PAGE_TEMPLATES.map((t) => [t.id, t] as const))("renders the %s template", (_, t) => {
    const doc = t.build({ storeName: DB.store.name, ownerName: DB.store.ownerName, slug: "my-store", products: live.map((p) => ({ id: p.id, title: p.title })), collections: [], brand: "#0F3D33", accent: "#C9A24F", now: NOW });
    render(<PageRenderer doc={doc} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    expect(document.querySelectorAll("section").length).toBeGreaterThan(0);
  });

  it("renders every block type", () => {
    const content = BLOCK_TYPES.filter((t) => !["section", "hero", "column"].includes(t)).map((t) => makeNode(t));
    const doc: PageDoc = { version: 1, blocks: [makeNode("hero", { headline: "Hi" }), makeNode("section", {}, { children: content })] };
    render(<PageRenderer doc={doc} context={CONTEXT} env={{ mode: "edit", currency: "INR" }} />);
    expect(screen.getByRole("heading", { name: "Hi" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-node-id]").length).toBeGreaterThanOrEqual(content.length + 2);
  });

  it("selects blocks in edit mode instead of following links", async () => {
    const onSelect = vi.fn();
    const button = makeNode("button", { label: "Go", href: "/elsewhere" });
    const doc: PageDoc = { version: 1, blocks: [makeNode("section", {}, { children: [button] })] };
    render(<PageRenderer doc={doc} context={CONTEXT} env={{ mode: "edit", currency: "INR", onSelect }} />);
    await userEvent.click(screen.getByText("Go"));
    expect(onSelect).toHaveBeenCalledWith(button.id);
    expect(screen.queryByRole("link", { name: "Go" })).not.toBeInTheDocument();
  });

  it("renders safe rich text and never HTML", () => {
    const doc: PageDoc = { version: 1, blocks: [makeNode("section", {}, { children: [makeNode("text", { text: "**Bold** and <b>raw</b> [link](/x)" })] })] };
    render(<PageRenderer doc={doc} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getByText(/<b>raw<\/b>/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "/x");
  });

  it("hides blocks per device on the live page", () => {
    const doc: PageDoc = { version: 1, blocks: [makeNode("section", {}, { visibility: { mobile: false } })] };
    const { container } = render(<PageRenderer doc={doc} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    expect(container.querySelector("section")!.className).toContain("@max-3xl/page:hidden");
  });

  it("warns about low contrast and picks a readable tone", () => {
    const dark = styleSchema.parse({ background: { kind: "solid", color: "#0F3D33" } });
    expect(autoTone(dark)).toBe("light");
    expect(contrastWarning(dark)).toBeUndefined();
    expect(contrastWarning({ ...dark, tone: "dark" })).toMatch(/hard to read/);
    expect(contrastWarning(styleSchema.parse({ background: { kind: "image", src: "", alt: "", focal: { x: 50, y: 50 } }, overlay: 0 }))).toMatch(/overlay/);
  });
});

describe("store blocks, cards and typing on the page", () => {
  it("renders cards, collections, offers, about and a store FAQ", () => {
    const cards = makeNode("cards", { columns: 2 }, { children: [makeNode("card", { title: "First card", text: "Words", ctaLabel: "More", ctaHref: "/s/x/about" }), makeNode("card", { title: "Second card" })] });
    const doc: PageDoc = { version: 1, blocks: [makeNode("section", {}, { children: [cards, makeNode("collection_list", {}), makeNode("offers", {}), makeNode("about", {}), makeNode("faq", { source: "store" })] })] };
    render(<PageRenderer doc={doc} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    expect(screen.getByRole("heading", { name: "First card" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "More" })).toHaveAttribute("href", "/s/x/about");
    expect(screen.getByRole("heading", { name: DB.design.about.name })).toBeInTheDocument();
    expect(screen.getByText("How do I get it?")).toBeInTheDocument();
  });

  it("gives sections their scheme and an anchor, and headings a View all link", () => {
    const heading = makeNode("heading", { text: "Bestsellers", linkLabel: "View all", linkHref: "/s/x/products" });
    const sec = makeNode("section", {}, { id: "sec1", style: { scheme: "scheme-4" }, children: [heading, makeNode("product_grid", { sort: "price-asc", limit: 2 })] });
    render(<PageRenderer doc={{ version: 1, blocks: [sec] }} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    const el = document.getElementById("section-sec1")!;
    expect(el).toHaveClass("pp-scheme-scheme-4");
    expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/s/x/products");
  });

  it("makes the first hero the page's h1 and later ones h2", () => {
    const doc: PageDoc = { version: 1, blocks: [makeNode("hero", { headline: "One" }), makeNode("hero", { headline: "Two", cta2Label: "Watch", cta2Href: "/s/x/about" })] };
    render(<PageRenderer doc={doc} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    expect(screen.getByRole("heading", { level: 1, name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Two" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watch" })).toBeInTheDocument();
  });

  it("lets text be typed straight into the page in the editor", () => {
    const onText = vi.fn();
    const heading = makeNode("heading", { text: "Old" });
    const table = makeNode("table", { rows: [["A", "B"], ["c", "d"]], header: true });
    render(<PageRenderer doc={{ version: 1, blocks: [makeNode("section", {}, { children: [heading, table] })] }} context={CONTEXT} env={{ mode: "edit", currency: "INR", onText }} />);
    const box = screen.getByRole("textbox", { name: "Heading" });
    expect(box).toHaveAttribute("contenteditable", "plaintext-only");
    box.innerText = "New";
    fireEvent.input(box);
    expect(onText).toHaveBeenCalledWith(heading.id, "text", "New");
    const cell = screen.getAllByRole("textbox", { name: "Cell" })[1];
    cell.innerText = "z";
    fireEvent.input(cell);
    expect(onText).toHaveBeenLastCalledWith(table.id, "rows.1.1", "z");
  });

  it("shows plain text on the live page", () => {
    render(<PageRenderer doc={{ version: 1, blocks: [makeNode("section", {}, { children: [makeNode("heading", { text: "Live" })] })] }} context={CONTEXT} env={{ mode: "live", currency: "INR", onText: vi.fn() }} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sets nested text by path without touching anything else", () => {
    const props = { rows: [["a", "b"], ["c", "d"]], header: true };
    expect(setAtPath(props, "rows.1.0", "x")).toEqual({ rows: [["a", "b"], ["x", "d"]], header: true });
    expect(props.rows[1][0]).toBe("c");
    expect(setAtPath({ items: [{ text: "a" }] }, "items.0.text", "b")).toEqual({ items: [{ text: "b" }] });
    expect(setAtPath(props, "rows.9.0", "x")).toBe(props);
    expect(setAtPath(props, "__proto__", "x")).toBe(props);
  });
});

describe("video, image links and alignment", () => {
  it("plays YouTube and Vimeo in their privacy-friendly players", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=abcdefgh")).toBe("https://www.youtube-nocookie.com/embed/abcdefgh");
    expect(embedUrl("https://youtu.be/abcdefgh")).toBe("https://www.youtube-nocookie.com/embed/abcdefgh");
    expect(embedUrl("https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456");
    expect(embedUrl("http://youtube.com/watch?v=abcdefgh")).toBeUndefined();
    expect(embedUrl("https://example.com/v")).toBeUndefined();
    const doc: PageDoc = { version: 1, blocks: [makeNode("section", {}, { children: [makeNode("video", { src: "https://youtu.be/abcdefgh", caption: "Tour" })] })] };
    render(<PageRenderer doc={doc} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    expect(screen.getByTitle("Tour")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/abcdefgh");
  });
  it("links an image when it has somewhere to go", () => {
    const doc: PageDoc = { version: 1, blocks: [makeNode("section", {}, { children: [makeNode("image", { src: "https://x.test/a.png", alt: "Kit", href: "/s/x/products" })] })] };
    render(<PageRenderer doc={doc} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    expect(screen.getByRole("link", { name: "Kit" })).toHaveAttribute("href", "/s/x/products");
  });
  it("aligns one block on its own, or follows the section", () => {
    const own = makeNode("heading", { text: "Mine" }, { style: { selfAlign: "right" } });
    const follows = makeNode("heading", { text: "Section's" });
    render(<PageRenderer doc={{ version: 1, blocks: [makeNode("section", {}, { style: { align: "center" }, children: [own, follows] })] }} context={CONTEXT} env={{ mode: "edit", currency: "INR" }} />);
    expect(document.querySelector(`[data-node-id="${own.id}"]`)).toHaveClass("text-right");
    expect(document.querySelector(`[data-node-id="${follows.id}"]`)).not.toHaveClass("text-right");
  });
});

describe("icons, backgrounds and links in the editor", () => {
  it("draws highlight icons from the library and lets the editor change one by clicking it", async () => {
    const onIcon = vi.fn();
    const hl = makeNode("highlights", { source: "manual", items: [{ icon: "Truck", title: "Fast", body: "" }] });
    render(<PageRenderer doc={{ version: 1, blocks: [makeNode("section", {}, { children: [hl] })] }} context={CONTEXT} env={{ mode: "edit", currency: "INR", onIcon, onSelect: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: "Change icon" }));
    expect(onIcon).toHaveBeenCalledWith(hl.id, "items.0.icon", "Truck");
  });

  it("keeps old icon names working", () => {
    const hl = makeNode("highlights", { source: "manual", items: [{ icon: "download", title: "Old", body: "" }] });
    render(<PageRenderer doc={{ version: 1, blocks: [makeNode("section", {}, { children: [hl] })] }} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("puts a content-area background on a panel, not across the page", () => {
    const sec = makeNode("section", {}, { id: "panel", style: { scheme: "scheme-4" }, layout: { fill: "content" }, children: [makeNode("heading", { text: "Hi" })] });
    render(<PageRenderer doc={{ version: 1, blocks: [sec] }} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    const outer = document.getElementById("section-panel")!;
    expect(outer).not.toHaveClass("pp-scheme-scheme-4");
    expect(outer.querySelector(".pp-scheme-scheme-4")).toHaveClass("rounded-card");
  });

  it("corrects colours on a section's own dark background so everything inside stays readable", () => {
    const sec = makeNode("section", {}, { id: "dark", style: { background: { kind: "solid", color: "#111111" } }, children: [makeNode("heading", { text: "Hi" })] });
    render(<PageRenderer doc={{ version: 1, blocks: [sec] }} context={CONTEXT} env={{ mode: "live", currency: "INR" }} />);
    const el = document.getElementById("section-dark")!;
    const fg = el.style.getPropertyValue("--foreground");
    expect(contrast(fg, "#111111")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(el.style.getPropertyValue("--primary"), "#111111")).toBeGreaterThanOrEqual(3);
    expect(contrast(el.style.getPropertyValue("--primary-foreground"), el.style.getPropertyValue("--primary"))).toBeGreaterThanOrEqual(4.5);
  });

  it("says where a header or footer link is edited", () => {
    const pages = [{ id: "home-id", title: "Home page", slug: "home", template: "home", status: "draft" as const, updatedAt: NOW_ISO, sections: 1, home: true }, { id: "sale-id", title: "Sale", slug: "sale", template: "sale", status: "published" as const, updatedAt: NOW_ISO, sections: 1 }];
    const base = `/s/${CONTEXT.store.slug}`;
    // About and FAQ open their panel beside the page
    expect(editTarget(`${base}/about`, CONTEXT, pages, "home-id")).toMatchObject({ kind: "panel", panel: "content", at: "about" });
    expect(editTarget(`${base}/faq`, CONTEXT, pages, "home-id")).toMatchObject({ kind: "panel", panel: "content", at: "faq" });
    expect(editTarget(`${base}/policies/refund`, CONTEXT, pages, "home-id")).toMatchObject({ kind: "route", href: "/store/current/pages/policies/refund" });
    expect(editTarget(`${base}/p/sale`, CONTEXT, pages, "home-id")).toMatchObject({ kind: "page", id: "sale-id" });
    expect(editTarget(base, CONTEXT, pages, "sale-id")).toMatchObject({ kind: "page", id: "home-id" });
    expect(editTarget(base, CONTEXT, pages, "home-id")).toMatchObject({ kind: "here" });
    expect(editTarget("#section-abc", CONTEXT, pages, "home-id")).toMatchObject({ kind: "section", id: "abc" });
    expect(editTarget("https://instagram.com/x", CONTEXT, pages, "home-id").kind).toBe("none");
    expect(editTarget(`${base}/${PRODUCTS[0].slug}`, CONTEXT, pages, "home-id")).toMatchObject({ kind: "route", href: `/catalog/products/${PRODUCTS[0].id}` });
  });
});

describe("section tree", () => {
  it("shows the header and footer groups and opens Add section", async () => {
    const doc: PageDoc = { version: 1, blocks: [makeNode("section", { label: "Intro" }, { children: [makeNode("heading", { text: "Hi" })] })] };
    render(
      <EditorProvider initial={doc} site={{ design: DB.design }}>
        <LayersPanel pageTitle="Home page" />
        <Probe />
      </EditorProvider>
    );
    expect(screen.getByRole("heading", { name: "Header" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Footer" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    expect(screen.getByTestId("adding")).toHaveTextContent('{"kind":"section","index":1}');
    await userEvent.click(screen.getByRole("button", { name: "Header" }));
    expect(screen.getByTestId("selected")).toHaveTextContent("@header");
    await userEvent.click(screen.getByRole("button", { name: "Hide Intro" }));
    expect(screen.getByRole("button", { name: "Show Intro" })).toBeInTheDocument();
  });
});

function Probe() {
  const adding = useEditor((s) => s.adding);
  const selected = useEditor((s) => s.selectedId);
  return (
    <>
      <p data-testid="adding">{JSON.stringify(adding ?? null)}</p>
      <p data-testid="selected">{selected}</p>
    </>
  );
}

describe("editor panels", () => {
  const doc = PAGE_TEMPLATES[0].build({ storeName: "S", ownerName: "Ana R", slug: "s", products: live.map((p) => ({ id: p.id, title: p.title })), collections: [], brand: "#0F3D33", accent: "#C9A24F", now: NOW });

  it("adds from the searchable menu", async () => {
    const onAdd = vi.fn();
    render(<AddBlockMenu onAdd={onAdd} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search blocks" }), "count");
    await userEvent.click(screen.getByRole("button", { name: /^Add Countdown/ }));
    expect(onAdd).toHaveBeenCalledWith("countdown");
    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText(/No block called/)).toBeInTheDocument();
  });

  it("switches device", async () => {
    const onChange = vi.fn();
    render(<DevicePreviewSwitch value="desktop" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Phone preview" }));
    expect(onChange).toHaveBeenCalledWith("mobile");
  });

  it("selects in Layers and edits in Settings", async () => {
    render(
      <EditorProvider initial={doc}>
        <LayersPanel />
        <SettingsPanel context={CONTEXT} />
      </EditorProvider>
    );
    expect(screen.getByText(/Select a section or block/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Hero:/ }));
    expect(screen.getByRole("tab", { name: "Content" })).toBeInTheDocument();
    const headline = screen.getByRole("textbox", { name: "Headline" });
    await userEvent.clear(headline);
    await userEvent.type(headline, "New words");
    expect(screen.getByRole("button", { name: /^Hero: New words/ })).toBeInTheDocument();
  });

  it("edits table cells, rows and columns", async () => {
    const onChange = vi.fn();
    render(<TableEditor rows={[["A", "B"]]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Row/ }));
    expect(onChange).toHaveBeenLastCalledWith([["A", "B"], ["", ""]]);
    await userEvent.click(screen.getByRole("button", { name: /Column/ }));
    expect(onChange).toHaveBeenLastCalledWith([["A", "B", ""]]);
  });
});
