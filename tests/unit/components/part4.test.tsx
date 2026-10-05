import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageRenderer, autoTone, contrastWarning } from "@/components/page-builder/renderer";
import { AddBlockMenu } from "@/components/page-builder/add-block-menu";
import { DevicePreviewSwitch } from "@/components/page-builder/device-preview-switch";
import { EditorProvider } from "@/components/page-builder/editor-context";
import { LayersPanel } from "@/components/page-builder/layers-panel";
import { SettingsPanel } from "@/components/page-builder/settings-panel";
import { TableEditor } from "@/components/page-builder/controls";
import { DealCard, GiftPicker, RuleSummaryChip, SavingsMeter } from "@/components/pp/deal-parts";
import { DealPanel } from "@/components/pp/deal-panel";
import { DealPreview } from "@/components/pp/deal-preview";
import { draftFromRule, emptyDraft, inputFromDraft, specFromDraft, validateStep, DealRuleWizard, type WizardDraft } from "@/components/pp/deal-rule-wizard";
import { ResultRow } from "@/components/search/result-row";
import type { CheckoutDeals, RenderContext } from "@/lib/api";
import { fromMajor, money } from "@/lib/money";
import { dealRuleSchema } from "@/lib/pricing/deal-rule-schema";
import { BLOCK_TYPES, makeNode, styleSchema, type PageDoc } from "@/lib/pages/schema";
import { PAGE_TEMPLATES } from "@/lib/pages/templates";
import { priceInfo, ratingSummary } from "@/lib/pricing";
import { DB, NOW } from "./fixtures";

const live = DB.products.filter((p) => p.status === "published");
const PRODUCTS = live.map((p) => ({ ...p, info: priceInfo(p, DB.deals, NOW), rating: ratingSummary([]) }));
const CONTEXT: RenderContext = { store: DB.store, theme: DB.design.theme, products: PRODUCTS, collections: DB.collections, reviews: [{ id: "r", title: "Great", body: "Loved it", author: "Priya S.", rating: 5 }] };
const RULES = DB.dealRules;

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
    render(<ResultRow result={{ type: "order", id: "o", title: "PP-1", href: "/x", email: "pr••••@gmail.com", masked: true, actions: ["open", "copy", "refund"] }} revealed={{}} onReveal={onReveal} onAction={onAction} />);
    expect(screen.getByText("pr••••@gmail.com")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reveal email for PP-1" }));
    expect(onReveal).toHaveBeenCalledWith("email");
    await userEvent.click(screen.getByRole("button", { name: "Refund: PP-1" }));
    expect(onAction).toHaveBeenCalledWith("refund");
  });

  it("shows the revealed value instead of the mask", () => {
    render(<ResultRow result={{ type: "order", id: "o", title: "PP-1", href: "/x", email: "pr••••@gmail.com", masked: true, actions: ["open"] }} revealed={{ "order:o:email": "priya@gmail.com" }} onAction={() => {}} />);
    expect(screen.getByText("priya@gmail.com")).toBeInTheDocument();
  });
});

describe("page renderer", () => {
  it.each(PAGE_TEMPLATES.map((t) => [t.id, t] as const))("renders the %s template", (_, t) => {
    const doc = t.build({ storeName: DB.store.name, ownerName: DB.store.ownerName, slug: "ananya", products: live.map((p) => ({ id: p.id, title: p.title })), collections: [], brand: "#0F3D33", accent: "#C9A24F", now: NOW });
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
    expect(screen.getByText(/Select a block/)).toBeInTheDocument();
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
