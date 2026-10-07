import { makeNode as n, type PageDoc } from "./schema";

/** What a template needs to know about the store. Product ids must exist in the store. */
export interface TemplateContext {
  storeName: string;
  ownerName: string;
  slug: string;
  products: { id: string; title: string }[];
  collections: { slug: string; name: string }[];
  brand: string;
  accent: string;
  now: number;
}

export interface PageTemplateDef {
  id: string;
  name: string;
  description: string;
  build: (ctx: TemplateContext) => PageDoc;
}

const doc = (...blocks: ReturnType<typeof n>[]): PageDoc => ({ version: 1, blocks });
const first = (ctx: TemplateContext, i = 0) => ctx.products[Math.min(i, ctx.products.length - 1)]?.id ?? "";
/** A product cover as media, or nothing when the store has no products yet */
const cover = (ctx: TemplateContext, i = 0) => (first(ctx, i) ? `product:${first(ctx, i)}` : "");

export const PAGE_TEMPLATES: PageTemplateDef[] = [
  {
    id: "launch",
    name: "Launch page",
    description: "One product, front and centre, with proof and a clear buy button.",
    build: (ctx) =>
      doc(
        n("hero", { eyebrow: "New", headline: ctx.products[0]?.title ?? "Your new product", subtext: "Everything you need to get started this week, in one download.", ctaLabel: "Get it now", ctaHref: `/s/${ctx.slug}/products`, image: cover(ctx), imageAlt: `${ctx.products[0]?.title ?? "Product"} cover`, layout: "split" }, { style: { background: { kind: "solid", color: "#F5F6F4" }, tone: "dark", align: "left", overlay: 0 }, layout: { paddingY: "lg", width: "wide", minHeight: "md", gap: "md" } }),
        n("section", { label: "What you get" }, { children: [n("heading", { text: "What you get", level: 2, size: "md" }), n("highlights", { items: [{ title: "Ready to use", body: "Open it and go." }, { title: "Lifetime updates", body: "Free, forever." }, { title: "Works everywhere", body: "Phone, tablet, laptop." }, { title: "Support", body: "Real replies from me." }] })] }),
        n("section", { label: "Buy" }, { layout: { paddingY: "lg", width: "narrow", minHeight: "auto", gap: "md" }, children: [n("product_card", { productId: first(ctx), showBuy: true })] }),
        n("section", { label: "Questions" }, { children: [n("heading", { text: "Questions", level: 2, size: "md" }), n("faq", { items: [{ q: "How do I get it?", a: "A download link appears right after you pay, and we email it too." }, { q: "Can I get a refund?", a: "Yes. Write within 7 days if it isn't right for you." }] })] })
      ),
  },
  {
    id: "sale",
    name: "Sale page",
    description: "A countdown, the products on offer, and one strong button.",
    build: (ctx) =>
      doc(
        n("section", { label: "Sale banner" }, {
          style: { background: { kind: "gradient", from: ctx.accent, to: "#A9823A", angle: 120 }, tone: "dark", align: "center", overlay: 0 },
          layout: { paddingY: "xl", width: "normal", minHeight: "auto", gap: "md" },
          children: [
            n("heading", { text: "The festive sale is on", level: 1, size: "xl" }),
            n("text", { text: "Up to 30% off for a few days only. No code needed.", size: "lg" }),
            n("countdown", { endsAt: new Date(ctx.now + 4 * 86_400_000).toISOString(), label: "Sale ends in" }),
          ],
        }),
        n("section", { label: "On sale" }, { layout: { paddingY: "lg", width: "wide", minHeight: "auto", gap: "md" }, children: [n("product_grid", { source: "manual", productIds: ctx.products.slice(0, 6).map((p) => p.id), limit: 6, columns: 3 })] }),
        n("section", { label: "Shop all" }, { style: { background: { kind: "none" }, tone: "auto", align: "center", overlay: 0 }, children: [n("button", { label: "See everything in the store", href: `/s/${ctx.slug}/products`, variant: "primary" })] })
      ),
  },
  {
    id: "bio",
    name: "Link in bio",
    description: "A tidy, phone-first list of your best links and products.",
    build: (ctx) =>
      doc(
        n("section", { label: "Profile" }, {
          style: { background: { kind: "solid", color: ctx.brand }, tone: "light", align: "center", overlay: 0 },
          layout: { paddingY: "lg", width: "narrow", minHeight: "auto", gap: "sm" },
          children: [n("heading", { text: ctx.storeName, level: 1, size: "lg" }), n("text", { text: `Made by ${ctx.ownerName}. Tap anything below.` })],
        }),
        n("section", { label: "Links" }, {
          layout: { paddingY: "md", width: "narrow", minHeight: "auto", gap: "sm" },
          style: { background: { kind: "none" }, tone: "auto", align: "center", overlay: 0 },
          children: [
            n("button", { label: "Shop everything", href: `/s/${ctx.slug}/products`, variant: "primary" }),
            ...ctx.collections.slice(0, 3).map((c) => n("button", { label: c.name, href: `/s/${ctx.slug}/c/${c.slug}`, variant: "secondary" })),
            n("button", { label: "About me", href: `/s/${ctx.slug}/about`, variant: "secondary" }),
          ],
        }),
        n("section", { label: "Favourites" }, { layout: { paddingY: "md", width: "narrow", minHeight: "auto", gap: "md" }, children: [n("product_grid", { source: "all", limit: 4, columns: 2 })] }),
        n("section", { label: "Newsletter" }, { layout: { paddingY: "md", width: "narrow", minHeight: "auto", gap: "md" }, children: [n("newsletter", { heading: "Stay in touch", body: "New things, once a month." })] })
      ),
  },
  {
    id: "blank",
    name: "Blank page",
    description: "Start from nothing and add your own blocks.",
    build: () => doc(n("section", { label: "Section" }, { children: [n("heading", { text: "Page title", level: 1, size: "lg" }), n("text", { text: "Write what you want buyers to read." })] })),
  },
];

export function templateById(id: string): PageTemplateDef {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? PAGE_TEMPLATES[0];
}
