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
    id: "about",
    name: "About me",
    description: "Your story, what you make, and what buyers say.",
    build: (ctx) =>
      doc(
        n("hero", { eyebrow: "Hello", headline: `I'm ${ctx.ownerName.split(" ")[0]}. I make ${ctx.storeName}.`, subtext: "Everything here started as something I made for myself. Then friends asked. Then everyone else did.", ctaLabel: "See what I make", ctaHref: `/s/${ctx.slug}/products`, layout: "centered" }, { style: { background: { kind: "gradient", from: ctx.brand, to: "#0C1F1B", angle: 135 }, tone: "light", align: "center", overlay: 0 }, layout: { paddingY: "xl", width: "normal", minHeight: "md", gap: "md" } }),
        n("section", { label: "Story" }, {
          children: [
            n("columns", { ratio: "equal", stackOnMobile: true }, {
              children: [
                n("column", {}, { children: [n("image", { src: cover(ctx), alt: `${ctx.storeName} product cover`, aspect: "4:3" })] }),
                n("column", {}, {
                  children: [
                    n("heading", { text: "Why I started", level: 2, size: "md" }),
                    n("text", { text: "I couldn't find tools that fit how I actually work, so I built my own. Every product is something I use every week, tidied up so it's easy for you to start with.\n\nNo upsells, no fluff. If something doesn't work for you, write to me and I'll fix it or refund you." }),
                  ],
                }),
              ],
            }),
          ],
        }),
        n("section", { label: "Highlights" }, { children: [n("highlights", { items: [{ title: "Instant download", body: "Files arrive the moment you pay." }, { title: "Made in India", body: "By one person, carefully." }, { title: "Real refunds", body: "Write within 7 days." }] })] }),
        n("section", { label: "Reviews" }, { children: [n("heading", { text: "What buyers say", level: 2, size: "md" }), n("testimonials", { source: "reviews", limit: 3 })] }),
        n("section", { label: "Newsletter" }, { style: { background: { kind: "solid", color: "#F6EFDF" }, tone: "dark", align: "center", overlay: 0 }, children: [n("newsletter", { heading: "Hear about new things first", body: "One short email when something new is out. Nothing else." })] })
      ),
  },
  {
    id: "launch",
    name: "Product launch",
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
    name: "Sale",
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
    id: "link_in_bio",
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
    id: "waitlist",
    name: "Freebie or waitlist",
    description: "Collect emails for something free or coming soon.",
    build: (ctx) =>
      doc(
        n("hero", { eyebrow: "Free", headline: "Get the starter kit, free", subtext: "A small sample of how I work. Enter your email and it's yours.", layout: "centered" }, { style: { background: { kind: "gradient", from: "#F6EFDF", to: "#F5F6F4", angle: 180 }, tone: "dark", align: "center", overlay: 0 }, layout: { paddingY: "xl", width: "narrow", minHeight: "auto", gap: "md" } }),
        n("section", { label: "Sign up" }, { layout: { paddingY: "md", width: "narrow", minHeight: "auto", gap: "md" }, children: [n("newsletter", { heading: "Send me the kit", body: "One email with the download link. Unsubscribe anytime." })] }),
        n("section", { label: "Inside" }, { children: [n("heading", { text: "What's inside", level: 2, size: "md" }), n("text", { text: "Three templates, a one-page guide, and the checklist I use before every launch." })] }),
        n("section", { label: "FAQ" }, { children: [n("faq", { items: [{ q: "Is it really free?", a: "Yes. No card needed." }, { q: "Will you spam me?", a: `No. ${ctx.storeName} sends one email a month at most.` }] })] })
      ),
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Show your work in a gallery, with kind words and a way to buy.",
    build: (ctx) =>
      doc(
        n("section", { label: "Intro" }, { layout: { paddingY: "lg", width: "normal", minHeight: "auto", gap: "sm" }, children: [n("heading", { text: "Selected work", level: 1, size: "xl" }), n("text", { text: "A few things I've made recently. Most of them are in the store.", size: "lg" })] }),
        n("section", { label: "Gallery" }, { layout: { paddingY: "md", width: "wide", minHeight: "auto", gap: "md" }, children: [n("gallery", { images: ctx.products.slice(0, 6).map((p) => ({ src: `product:${p.id}`, alt: p.title })), columns: 3 })] }),
        n("section", { label: "Kind words" }, { style: { background: { kind: "solid", color: "#0F3D33" }, tone: "light", align: "center", overlay: 0 }, children: [n("testimonials", { source: "manual", items: [{ quote: "Exactly what I needed, and it looked great on day one.", author: "Priya S." }, { quote: "Thoughtful, clear and genuinely useful.", author: "Rahul M." }] })] }),
        n("section", { label: "Shop" }, { style: { background: { kind: "none" }, tone: "auto", align: "center", overlay: 0 }, children: [n("button", { label: "Visit the store", href: `/s/${ctx.slug}`, variant: "brass" })] })
      ),
  },
];

export function templateById(id: string): PageTemplateDef {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? PAGE_TEMPLATES[0];
}
