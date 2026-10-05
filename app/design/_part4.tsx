"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AddBlockMenu } from "@/components/page-builder/add-block-menu";
import { BackgroundPicker, MediaUploader, TableEditor } from "@/components/page-builder/controls";
import { DevicePreviewSwitch } from "@/components/page-builder/device-preview-switch";
import { EditorProvider } from "@/components/page-builder/editor-context";
import { LayersPanel } from "@/components/page-builder/layers-panel";
import { PageRenderer } from "@/components/page-builder/renderer";
import { SettingsPanel } from "@/components/page-builder/settings-panel";
import { DealCard, GiftPicker, RuleSummaryChip, SavingsMeter } from "@/components/pp/deal-parts";
import { DealPanel } from "@/components/pp/deal-panel";
import { MobilePayBar } from "@/components/pp/mobile-pay-bar";
import { Segmented } from "@/components/pp/segmented";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { ResultRow } from "@/components/search/result-row";
import type { CheckoutDeals, RenderContext } from "@/lib/api";
import { fromMajor, money } from "@/lib/money";
import type { Device } from "@/lib/pages/editor-store";
import { styleSchema, type BlockStyle } from "@/lib/pages/schema";
import { templateById } from "@/lib/pages/templates";
import type { DealRule, DealRuleSpec, SearchResult } from "@/lib/types";
import { SAMPLE_PRODUCT } from "./_fixtures";
import { Section, Specimen } from "./_section";

const P2 = { ...SAMPLE_PRODUCT, id: "demo-2", title: "The Freelance Pricing Playbook", price: fromMajor(599), images: [{ ...SAMPLE_PRODUCT.images[0], id: "i2", cover: { ...SAMPLE_PRODUCT.images[0].cover!, title: "Pricing Playbook", bg: "#C9A24F", fg: "#0C1F1B", accent: "#0F3D33" } }] };
const P3 = { ...SAMPLE_PRODUCT, id: "demo-3", title: "Resume Templates", price: fromMajor(249), images: [{ ...SAMPLE_PRODUCT.images[0], id: "i3", cover: { ...SAMPLE_PRODUCT.images[0].cover!, title: "Resume Templates", bg: "#1D5C7A", fg: "#F5F6F4", accent: "#C9A24F" } }] };
const RATING = { average: 4.8, count: 38, bars: [0, 0, 1, 6, 31] as [number, number, number, number, number] };
const PRODUCTS = [SAMPLE_PRODUCT, P2, P3].map((p) => ({ ...p, info: { price: p.price }, rating: RATING }));
const titleOf = (id: string) => PRODUCTS.find((p) => p.id === id)?.title ?? "a product";

const rule = (id: string, name: string, spec: DealRuleSpec): DealRule => ({ ...spec, id, name, active: true, stackable: false, createdAt: "2026-09-01T00:00:00.000Z", stats: { views: 1200, uses: 140, revenueLift: fromMajor(42000) } }) as DealRule;
const RULES: DealRule[] = [
  rule("r1", "Brain + Playbook", { kind: "bundle_discount", productIds: ["demo", "demo-2"], percent: 25 }),
  rule("r2", "Gift over ₹1,500", { kind: "choose_gift", triggerIds: [], minSpend: fromMajor(1500), giftIds: ["demo-3", "demo-2"] }),
  rule("r3", "Ladder", { kind: "tiers", productIds: [], tiers: [{ minItems: 2, percent: 10 }, { minItems: 3, percent: 20 }] }),
  rule("r4", "Spend ₹999", { kind: "spend_threshold", minSpend: fromMajor(999), percent: 15 }),
  rule("r5", "Three for two", { kind: "buy_x_get_cheapest", productIds: [], buy: 3 }),
  rule("r6", "Bonus", { kind: "free_gift", triggerIds: ["demo"], giftId: "demo-3" }),
  rule("r7", "Flash", { kind: "limited_time", productIds: ["demo-2"], percent: 30 }),
];

const DEALS: CheckoutDeals = {
  offers: [
    { ruleId: "r1", ruleName: "Brain + Playbook", kind: "add", addProductIds: ["demo-2"], saving: fromMajor(524.5), extraCost: fromMajor(74.5) },
    { ruleId: "r3", ruleName: "Ladder", kind: "add", addProductIds: ["demo-3"], saving: fromMajor(174.8), extraCost: fromMajor(74.2) },
    { ruleId: "r4", ruleName: "Spend ₹999", kind: "add", addProductIds: ["demo-3"], saving: fromMajor(150), extraCost: fromMajor(99), progress: { current: fromMajor(749), target: fromMajor(999) } },
    { ruleId: "r5", ruleName: "Three for two", kind: "add", addProductIds: ["demo-2", "demo-3"], saving: fromMajor(249), extraCost: fromMajor(599) },
  ],
  pendingChoices: ["r2"],
  saving: money(0),
  rules: RULES,
  products: PRODUCTS,
  skipped: false,
};

const CONTEXT: RenderContext = {
  store: { id: "s", name: "Ananya Makes", slug: "ananya", tagline: "Notion kits, presets and playbooks.", ownerName: "Ananya Rao", ownerEmail: "a@example.com", brandColor: "#0F3D33", logoText: "AM", currency: "INR", supportEmail: "help@example.com", refundPolicy: "", refundDays: 7, createdAt: "2026-01-01T00:00:00.000Z", onboarded: true },
  theme: { palette: "emerald", fonts: "modern", heroStyle: "left" },
  products: PRODUCTS,
  collections: [],
  reviews: [{ id: "rv", title: "Worth it", body: "Used it the same evening. Saved me hours.", author: "Priya S.", rating: 5 }],
};

const TEMPLATE_CTX = { storeName: "Ananya Makes", ownerName: "Ananya Rao", slug: "ananya", products: PRODUCTS.map((p) => ({ id: p.id, title: p.title })), collections: [], brand: "#0F3D33", accent: "#C9A24F", now: Date.UTC(2030, 0, 1) };
const SALE = templateById("sale").build(TEMPLATE_CTX);
const ABOUT = templateById("about").build(TEMPLATE_CTX);

const RESULTS: SearchResult[] = [
  { type: "order", id: "ord_1042", title: "PP-1042", subtitle: "Meera Pillai · Notion Habit Tracker", status: "paid", amount: fromMajor(299), date: "2026-09-08T10:00:00.000Z", href: "#", email: "me••••@outlook.com", phone: "+91 ••••••3210", masked: true, storeName: "Ananya Makes", actions: ["open", "copy", "refund"] },
  { type: "creator", id: "cr_4", title: "Karan Malhotra", subtitle: "Frame Theory · Delhi", status: "past_due", amount: fromMajor(48200), date: "2026-05-02T10:00:00.000Z", href: "#", email: "fr••••@example.com", masked: true, storeName: "Frame Theory", actions: ["open", "copy", "suspend_store"] },
  { type: "review", id: "rv_1", title: "Worth every rupee", subtitle: "5★ · Priya S.", status: "shown", date: "2026-09-20T10:00:00.000Z", href: "#", storeName: "Ananya Makes", actions: ["open", "copy", "hide_review"] },
];

export function Part4Components() {
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<"page" | "section">("page");
  const [gift, setGift] = useState<string>();
  const [style, setStyle] = useState<BlockStyle>(() => styleSchema.parse({ background: { kind: "solid", color: "#0F3D33" }, tone: "light" }));
  const [rows, setRows] = useState([["Plan", "Price"], ["Starter", "₹499"], ["Pro", "₹1,499"]]);
  const [media, setMedia] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  return (
    <>
      <Section id="deals" title="Deal paths" description="The checkout panel and its parts. Nothing is ever pre-selected; the meter shows what's saved now and what's still on the table.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Specimen label="RuleSummaryChip, every rule type">
            <div className="flex flex-wrap gap-2">
              {RULES.map((r) => (
                <RuleSummaryChip key={r.id} rule={r} titleOf={titleOf} />
              ))}
            </div>
          </Specimen>
          <Specimen label="SavingsMeter: nothing yet, and partway">
            <SavingsMeter saved={money(0)} potential={fromMajor(524.5)} currency="INR" />
            <SavingsMeter saved={fromMajor(524.5)} potential={fromMajor(249)} currency="INR" />
          </Specimen>
          <Specimen label="DealCard, with spend progress">
            <ul className="flex flex-col gap-2">
              <DealCard offer={DEALS.offers[0]} rule={RULES[0]} products={PRODUCTS} currency="INR" onAdd={() => toast("Added")} titleOf={titleOf} />
              <DealCard offer={DEALS.offers[2]} rule={RULES[3]} products={PRODUCTS} currency="INR" onAdd={() => toast("Added")} titleOf={titleOf} />
            </ul>
          </Specimen>
          <Specimen label="GiftPicker">
            <GiftPicker idPrefix="design-gift" title="You've unlocked a free gift. Pick one:" options={[P3, P2]} selected={gift} currency="INR" onPick={setGift} />
          </Specimen>
          <Specimen label="DealPanel" className="lg:col-span-2">
            <div className="max-w-md">
              <DealPanel idPrefix="design-deal" deals={DEALS} items={[]} added={[]} currency="INR" onAdd={() => toast("Added")} onRemove={() => {}} onGift={(_, id) => setGift(id)} giftChoices={gift ? { r2: gift } : undefined} onSkip={() => toast("Deals hidden")} />
            </div>
          </Specimen>
          <Specimen label="MobilePayBar (fixed to the bottom on phones)">
            <MobilePayBar preview total={fromMajor(1573.5)} savings={fromMajor(524.5)} />
            <MobilePayBar preview total={money(0)} />
          </Specimen>
        </div>
      </Section>

      <Section id="search" title="Search results" description="One row design for the palette and the results page. Admin rows mask buyer contact until revealed, and every reveal is logged.">
        <Specimen label="ResultRow">
          <ul className="flex flex-col divide-y">
            {RESULTS.map((r) => (
              <li key={r.id} className="py-3">
                <ResultRow result={r} revealed={revealed} showStore onReveal={(f) => setRevealed((x) => ({ ...x, [`${r.type}:${r.id}:${f}`]: f === "email" ? "meera.pillai@outlook.com" : "+91 98765 43210" }))} onAction={(a) => toast(`${a} (demo)`)} />
              </li>
            ))}
          </ul>
        </Specimen>
      </Section>

      <Section id="builder" title="Page builder" description="Store pages are a tree of blocks rendered by one renderer, here and on the live store. Container queries make the device preview honest.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Specimen label="AddBlockMenu">
            <AddBlockMenu onAdd={(t) => toast(`Add ${t}`)} />
          </Specimen>
          <div className="flex min-w-0 flex-col gap-4">
            <Specimen label="DevicePreviewSwitch and preview mode">
              <div className="flex flex-wrap items-center gap-3">
                <DevicePreviewSwitch value={device} onChange={setDevice} />
                <Segmented label="Preview" value={mode} onChange={setMode} options={[{ value: "page", label: "Full page" }, { value: "section", label: "This section" }]} />
              </div>
            </Specimen>
            <Specimen label="PageRenderer: Sale template">
              <div className="mx-auto w-full overflow-hidden rounded-card border" style={{ maxWidth: device === "mobile" ? 390 : device === "tablet" ? 820 : "100%" }}>
                <StoreThemeScope theme={CONTEXT.theme}>
                  <PageRenderer doc={mode === "section" ? { ...SALE, blocks: SALE.blocks.slice(0, 1) } : SALE} context={CONTEXT} env={{ mode: "live", currency: "INR", onBuy: () => toast("Buy now opens checkout") }} />
                </StoreThemeScope>
              </div>
            </Specimen>
          </div>
          <Specimen label="BackgroundPicker (with contrast warning)">
            <BackgroundPicker style={style} context={CONTEXT} onChange={(patch) => setStyle((s) => ({ ...s, ...patch }))} />
          </Specimen>
          <div className="flex min-w-0 flex-col gap-4">
            <Specimen label="TableEditor">
              <TableEditor rows={rows} onChange={setRows} />
            </Specimen>
            <Specimen label="MediaUploader (image or GIF, 5 MB)">
              <MediaUploader label="Image" value={media} kinds={["image", "gif"]} context={CONTEXT} onChange={setMedia} />
            </Specimen>
          </div>
          <EditorProvider initial={ABOUT}>
            <Specimen label="LayersPanel">
              <LayersPanel />
            </Specimen>
            <Specimen label="SettingsPanel (select a layer)">
              <SettingsPanel context={CONTEXT} />
            </Specimen>
          </EditorProvider>
        </div>
      </Section>
    </>
  );
}
