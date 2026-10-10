import { kindOf, targetHref } from "../store-themes";
import type { SectionSetting, StoreDesign } from "../types";
import { makeNode as n, type Background, type NodeOverrides, type PageDoc, type PageNode } from "./schema";

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
const first = (ctx: Pick<TemplateContext, "products">, i = 0) => ctx.products[Math.min(i, ctx.products.length - 1)]?.id ?? "";
/** A product cover as media, or nothing when the store has no products yet */
const cover = (ctx: Pick<TemplateContext, "products">, i = 0) => (first(ctx, i) ? `product:${first(ctx, i)}` : "");

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
    id: "lead",
    name: "Lead generation",
    description: "Offer something free for a name and email. Everyone who signs up lands in Sales › Leads.",
    build: (ctx) =>
      doc(
        n("hero", { headline: "Get the free starter guide", subtext: `A short, practical guide from ${ctx.storeName}. Tell us where to send it.`, layout: "centered" }, { style: { background: { kind: "solid", color: "#F5F6F4" }, tone: "dark", align: "center", overlay: 0 }, layout: { paddingY: "lg", width: "wide", minHeight: "auto", gap: "md" } }),
        n("section", { label: "Sign up" }, { layout: { paddingY: "lg", width: "narrow", minHeight: "auto", gap: "md" }, children: [n("lead_form", { heading: "Where should we send it?", body: "No spam. One email, then occasional updates.", buttonLabel: "Send me the guide", successMessage: "Thanks! Check your inbox in a minute." })] }),
        n("section", { label: "Why" }, { children: [n("highlights", { items: [{ title: "Short", body: "Read it in ten minutes." }, { title: "Practical", body: "Things you can use today." }, { title: "Free", body: "Always." }] })] })
      ),
  },
  {
    id: "squeeze",
    name: "Squeeze page",
    description: "One promise, one form, nothing else. The store menu and footer are hidden.",
    build: () => ({
      ...doc(
        n("section", { label: "Squeeze" }, {
          style: { background: { kind: "none" }, tone: "auto", align: "center", overlay: 0 },
          layout: { paddingY: "xl", width: "narrow", minHeight: "screen", gap: "md" },
          children: [
            n("heading", { text: "Learn the one thing that doubles your results", level: 1, size: "xl" }),
            n("text", { text: "Free 5-day email course. Join today and start tomorrow.", size: "lg" }),
            n("highlights", { items: [{ title: "5 short lessons", body: "Five minutes each." }, { title: "Real examples", body: "No theory dumps." }, { title: "Unsubscribe any time", body: "One click." }] }),
            n("lead_form", { heading: "Save my seat", body: "", fields: [{ id: "name", label: "First name", type: "text", required: true }, { id: "email", label: "Email", type: "email", required: true }], buttonLabel: "Yes, send me lesson 1", successMessage: "You're in! Lesson 1 is on its way." }),
          ],
        })
      ),
      focus: true,
    }),
  },
  {
    id: "booking",
    name: "Book a call",
    description: "An instant calendar: visitors pick a free time and leave their details.",
    build: (ctx) =>
      doc(
        n("section", { label: "Intro" }, { style: { background: { kind: "none" }, tone: "auto", align: "center", overlay: 0 }, layout: { paddingY: "lg", width: "narrow", minHeight: "auto", gap: "sm" }, children: [n("heading", { text: `Talk to ${ctx.ownerName}`, level: 1, size: "lg" }), n("text", { text: "A short call to see how I can help. Pick a time that works for you." })] }),
        n("section", { label: "Calendar" }, { layout: { paddingY: "md", width: "narrow", minHeight: "auto", gap: "md" }, children: [n("booking", { heading: "Pick a day and time", durationMin: 30 })] }),
        n("section", { label: "Questions" }, { layout: { paddingY: "md", width: "narrow", minHeight: "auto", gap: "md" }, children: [n("faq", { items: [{ q: "What happens on the call?", a: "We talk through what you need and whether I can help. No pressure." }, { q: "Can I change the time?", a: "Yes. Reply to the confirmation email and we'll move it." }] })] })
      ),
  },
  {
    id: "clickthrough",
    name: "Click-through page",
    description: "Warm people up with a short pitch, then send them on to the product with one button.",
    build: (ctx) =>
      doc(
        n("hero", { eyebrow: "", headline: "Here's why people choose this", subtext: "Three reasons, then you can decide.", ctaLabel: "Continue to the offer", ctaHref: `/s/${ctx.slug}/products`, image: cover(ctx), imageAlt: "", layout: "split" }, { style: { background: { kind: "solid", color: "#F5F6F4" }, tone: "dark", align: "left", overlay: 0 }, layout: { paddingY: "lg", width: "wide", minHeight: "md", gap: "md" } }),
        n("section", { label: "Reasons" }, { children: [n("highlights", { items: [{ title: "Saves time", body: "Everything in one place." }, { title: "Easy to start", body: "Open it and go." }, { title: "Backed by a refund", body: "If it isn't right, tell us." }] })] }),
        n("section", { label: "Go" }, { style: { background: { kind: "none" }, tone: "auto", align: "center", overlay: 0 }, layout: { paddingY: "lg", width: "narrow", minHeight: "auto", gap: "md" }, children: [n("button", { label: "Continue to the offer", href: `/s/${ctx.slug}/products`, variant: "brass", size: "lg" })] })
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

/* ------------------------------------------------------------------ */
/* Section presets: what "Add section" offers                           */
/* ------------------------------------------------------------------ */

/** What a preset needs to know about the store */
export type PresetContext = Pick<TemplateContext, "slug" | "products" | "collections">;

export interface SectionPreset {
  id: string;
  name: string;
  description: string;
  group: "Intro" | "Text and layout" | "Media" | "Store" | "Engage" | "Advanced";
  build: (ctx: PresetContext) => ReturnType<typeof n>;
}

/** New sections keep colours behind their content; banners and strips set "full" themselves */
const pad = (paddingY: "sm" | "md" | "lg" | "xl", width: "narrow" | "normal" | "wide" | "full" = "normal") => ({ paddingY, width, minHeight: "auto" as const, gap: "md" as const, fill: "content" as const });
const center = { align: "center" as const };
const titled = (label: string, heading: string, ...children: ReturnType<typeof n>[]) => n("section", { label }, { layout: pad("md", "wide"), children: [n("heading", { text: heading, level: 2, size: "md" }), ...children] });

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: "hero",
    name: "Hero",
    description: "A big headline, a line under it, buttons and your product pictures.",
    group: "Intro",
    build: (ctx) => n("hero", { headline: "A headline that says what you sell", subtext: "One line on who it's for and why it helps.", ctaLabel: "Shop now", ctaHref: `/s/${ctx.slug}/products`, image: cover(ctx), layout: ctx.products.length ? "split" : "left" }, { layout: { paddingY: "lg", width: "wide", minHeight: "md", gap: "md" } }),
  },
  {
    id: "image-banner",
    name: "Image banner",
    description: "Words and a button over a full-width picture or video.",
    group: "Intro",
    build: (ctx) =>
      n("section", { label: "Image banner" }, {
        style: { background: { kind: "image", src: cover(ctx), alt: "", focal: { x: 50, y: 50 } }, overlay: 0.45, tone: "light", ...center },
        layout: { paddingY: "xl", width: "normal", minHeight: "lg", gap: "md", fill: "full" },
        children: [n("heading", { text: "Make it yours", level: 2, size: "xl" }), n("text", { text: "A short line that invites people in.", size: "lg" }), n("button", { label: "Shop now", href: `/s/${ctx.slug}/products`, size: "lg" })],
      }),
  },
  {
    id: "rich-text",
    name: "Rich text",
    description: "A heading, a few lines and a button.",
    group: "Text and layout",
    build: (ctx) => n("section", { label: "Rich text" }, { style: center, layout: pad("lg", "narrow"), children: [n("heading", { text: "Talk about your brand", level: 2, size: "lg" }), n("text", { text: "Share what makes your work different, who it's for, and what people get." }), n("button", { label: "Learn more", href: `/s/${ctx.slug}/about`, variant: "secondary" })] }),
  },
  {
    id: "image-with-text",
    name: "Image with text",
    description: "A picture beside a heading, text and a button.",
    group: "Text and layout",
    build: (ctx) =>
      n("section", { label: "Image with text" }, {
        layout: pad("lg", "wide"),
        children: [
          n("columns", { ratio: "equal" }, {
            children: [
              n("column", {}, { children: [n("image", { src: cover(ctx), aspect: "4:3" })] }),
              n("column", {}, { children: [n("heading", { text: "Made with care", level: 2, size: "md" }), n("text", { text: "Pair a picture with a few lines about a product, a collection or how you work." }), n("button", { label: "Shop now", href: `/s/${ctx.slug}/products` })] }),
            ],
          }),
        ],
      }),
  },
  {
    id: "cards",
    name: "Cards",
    description: "Two to four cards side by side, each with a picture, words and a link.",
    group: "Text and layout",
    build: () => titled("Cards", "Why people choose us", n("cards", { columns: 3 })),
  },
  {
    id: "table",
    name: "Comparison table",
    description: "Rows and columns: plans, specs or what's included.",
    group: "Text and layout",
    build: () => titled("Table", "Compare", n("table", { rows: [["", "Basic", "Pro"], ["Files", "1", "All"], ["Updates", "No", "Yes"], ["Support", "Email", "Priority"]], header: true, striped: true })),
  },
  {
    id: "highlights",
    name: "Highlights",
    description: "Instant download, secure payment, refunds and your rating. Or your own points.",
    group: "Text and layout",
    build: () => n("section", { label: "Highlights" }, { layout: pad("sm", "wide"), children: [n("highlights", { source: "auto" })] }),
  },
  {
    id: "image",
    name: "Image",
    description: "One picture or GIF, full width.",
    group: "Media",
    build: (ctx) => n("section", { label: "Image" }, { layout: pad("md", "wide"), children: [n("image", { src: cover(ctx), aspect: "16:9" })] }),
  },
  {
    id: "video",
    name: "Video",
    description: "An uploaded video with a poster.",
    group: "Media",
    build: () => n("section", { label: "Video" }, { layout: pad("md", "wide"), children: [n("video", {})] }),
  },
  {
    id: "gallery",
    name: "Gallery",
    description: "A grid of up to 12 pictures.",
    group: "Media",
    build: () => titled("Gallery", "Gallery", n("gallery", { columns: 3 })),
  },
  {
    id: "marquee",
    name: "Scrolling strip",
    description: "A moving line of words or logos.",
    group: "Media",
    build: () => n("section", { label: "Scrolling strip" }, { layout: pad("sm", "full"), children: [n("marquee", { items: ["Instant download", "Secure payment", "Loved by buyers"].map((text) => ({ text })) })] }),
  },
  {
    id: "featured-products",
    name: "Featured products",
    description: "Your products in a grid, sorted how you like.",
    group: "Store",
    build: (ctx) => titledLink("Featured products", "Bestsellers", `/s/${ctx.slug}/products?sort=popular`, n("product_grid", { sort: "popular", limit: 4, columns: 4 })),
  },
  {
    id: "collection-list",
    name: "Collection list",
    description: "Tiles that open each collection.",
    group: "Store",
    build: (ctx) => titledLink("Collections", "Shop by collection", `/s/${ctx.slug}/products`, n("collection_list", {}), "All products"),
  },
  {
    id: "offers",
    name: "Offers",
    description: "Your live bundles, ready to buy.",
    group: "Store",
    build: () => titled("Offers", "Offers", n("offers", {})),
  },
  {
    id: "testimonials",
    name: "Reviews",
    description: "Your best verified reviews, or quotes you write.",
    group: "Store",
    build: () => titled("Reviews", "What buyers say", n("testimonials", { source: "reviews", limit: 3 })),
  },
  {
    id: "about",
    name: "About you",
    description: "Your photo and story from Store › Pages › About.",
    group: "Store",
    build: () => n("section", { label: "About" }, { layout: pad("md", "wide"), children: [n("about", {})] }),
  },
  {
    id: "faq",
    name: "FAQ",
    description: "Questions and answers that open on tap.",
    group: "Engage",
    build: () => n("section", { label: "FAQ" }, { layout: pad("md", "narrow"), children: [n("heading", { text: "Questions", level: 2, size: "md" }), n("faq", { source: "store" })] }),
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Collect emails from visitors.",
    group: "Engage",
    build: () => n("section", { label: "Newsletter" }, { layout: pad("md", "normal"), children: [n("newsletter", {})] }),
  },
  {
    id: "countdown",
    name: "Countdown",
    description: "A timer to the end of an offer.",
    group: "Engage",
    build: () => n("section", { label: "Countdown" }, { style: center, layout: pad("md", "narrow"), children: [n("countdown", { endsAt: new Date(Date.now() + 3 * 864e5).toISOString() })] }),
  },
  {
    id: "lead-form",
    name: "Contact form",
    description: "Name, email and a message. Lands in Sales › Leads.",
    group: "Engage",
    build: () => n("section", { label: "Contact form" }, { layout: pad("md", "narrow"), children: [n("lead_form", { heading: "Get in touch", buttonLabel: "Send", fields: [{ id: "name", label: "Your name", type: "text", required: true }, { id: "email", label: "Email", type: "email", required: true }, { id: "message", label: "Message", type: "textarea", required: false }], successMessage: "Thanks! We'll reply soon." })] }),
  },
  {
    id: "custom-html",
    name: "Custom HTML",
    description: "A section made from an HTML file you upload.",
    group: "Advanced",
    build: () => n("section", { label: "Custom HTML" }, { layout: { paddingY: "none", width: "full", minHeight: "auto", gap: "md" }, children: [n("custom_html", {})] }),
  },
  {
    id: "blank",
    name: "Empty section",
    description: "Start empty and add blocks.",
    group: "Advanced",
    build: () => n("section", { label: "Section" }, { children: [n("heading", { text: "Heading", level: 2, size: "md" })] }),
  },
];

function titledLink(label: string, heading: string, href: string, child: ReturnType<typeof n>, linkLabel = "View all") {
  return n("section", { label }, { layout: pad("md", "wide"), children: [n("heading", { text: heading, level: 2, size: "md", linkLabel, linkHref: href }), child] });
}

export function presetById(id: string): SectionPreset | undefined {
  return SECTION_PRESETS.find((p) => p.id === id);
}

/* ------------------------------------------------------------------ */
/* The store home, from the section layout it had before the editor     */
/* ------------------------------------------------------------------ */

/** The page template id a store's home is saved with */
export const HOME_TEMPLATE = "home";

const SPACE = { none: "none", sm: "sm", md: "md", lg: "lg" } as const;

/** A link from the old design as a page link: a store path, #anchor or https */
const href = (slug: string, target?: string) => {
  const h = targetHref(slug, target);
  return /^(\/(?!\/)|#|https:\/\/|mailto:)/i.test(h) ? h : `/s/${slug}/products`;
};

/** The section's spacing, width, alignment, panel and visibility as page-builder settings */
function frame(s: SectionSetting, children: PageNode[], label: string, extra: NodeOverrides = {}): PageNode {
  const l = s.layout ?? {};
  return n("section", { label }, {
    // Keeping the id keeps "#section-<id>" links working
    id: s.id,
    ...extra,
    style: { align: l.align ?? "left", ...(l.tone === "soft" ? { scheme: "scheme-3", radius: "md" as const } : l.tone === "outline" ? { border: true, radius: "md" as const } : {}), ...extra.style },
    // Panels and colours sit behind the content, like the old tinted panels, not across the whole page
    layout: { paddingY: l.space ? SPACE[l.space] : "md", width: l.width ?? "wide", minHeight: "auto", gap: "md", fill: "content", ...extra.layout },
    visibility: { mobile: l.hideOn !== "mobile", desktop: l.hideOn !== "desktop" },
    children,
  });
}

function heroBackground(bg: StoreDesign["hero"]["background"]): { background: Background; overlay: number } | undefined {
  if (!bg) return undefined;
  if (bg.kind === "color") return { background: { kind: "solid", color: bg.color }, overlay: 0 };
  if (bg.kind === "image") return bg.src ? { background: { kind: "image", src: bg.src, alt: bg.alt, focal: bg.focal }, overlay: bg.overlay ?? 0.4 } : undefined;
  return bg.src ? { background: { kind: "video", src: bg.src, poster: bg.poster, focal: bg.focal }, overlay: bg.overlay ?? 0.4 } : undefined;
}

/**
 * The store home as a page: every section that was showing, in the same order, with its words,
 * pictures, links and layout. Used once, when a store first opens the editor, and to show stores
 * that haven't yet.
 */
export function homeDocFrom(design: StoreDesign, slug: string, productIds: string[] = []): PageDoc {
  const blocks: PageNode[] = [];
  for (const s of design.sections) {
    if (!s.enabled) continue;
    const kind = kindOf(s);
    const c = s.content ?? {};
    const title = (fallback: string, link?: { label: string; to: string }) => n("heading", { text: s.title || fallback, level: 2, size: "md", ...(link ? { linkLabel: link.label, linkHref: link.to } : {}) });
    switch (kind) {
      case "hero": {
        const h = c.hero ?? design.hero;
        const ids = h.imageProductIds.length ? h.imageProductIds : productIds.slice(0, 3);
        const bg = heroBackground(h.background);
        const style = design.theme.heroStyle;
        const second = h.cta2Label ? { cta2Label: h.cta2Label, cta2Href: href(slug, h.cta2Target) } : h.videoUrl ? { cta2Label: "Watch the video", cta2Href: href(slug, `url:${h.videoUrl}`) } : {};
        blocks.push(
          n("hero", {
            headline: h.headline.slice(0, 120) || "Welcome",
            subtext: h.subtext.slice(0, 300),
            ctaLabel: h.ctaLabel.slice(0, 40),
            ctaHref: href(slug, h.ctaTarget),
            ...second,
            image: !bg && ids[0] ? `product:${ids[0]}` : "",
            moreImages: !bg ? ids.slice(1, 3).map((id) => `product:${id}`) : [],
            layout: style === "centered" ? "centered" : !bg && ids[0] ? "split" : "left",
          }, {
            id: s.id,
            style: { align: s.layout?.align ?? (style === "centered" ? "center" : "left"), ...(bg ? { ...bg, tone: bg.background.kind === "solid" ? "auto" : "light" } : {}) },
            layout: { paddingY: "lg", width: "wide", minHeight: bg ? "lg" : "md", gap: "md" },
            visibility: { mobile: s.layout?.hideOn !== "mobile", desktop: s.layout?.hideOn !== "desktop" },
          })
        );
        break;
      }
      case "highlights":
        blocks.push(frame(s, [n("highlights", c.highlights?.length ? { source: "manual", items: c.highlights.slice(0, 4) } : { source: "auto" })], "Highlights", { layout: { paddingY: s.layout?.space ? SPACE[s.layout.space] : "sm" } }));
        break;
      case "collections":
        blocks.push(frame(s, [title("Shop by collection", { label: "All products", to: `/s/${slug}/products` }), n("collection_list", {})], "Collections"));
        break;
      case "bestsellers":
        blocks.push(frame(s, [title("Bestsellers", { label: "View all", to: `/s/${slug}/products?sort=popular` }), n("product_grid", { sort: "popular", limit: c.count ?? 4, columns: 4 })], "Bestsellers"));
        break;
      case "new":
        blocks.push(frame(s, [title("New arrivals", { label: "View all", to: `/s/${slug}/products?sort=newest` }), n("product_grid", { sort: "newest", limit: c.count ?? 4, columns: 4 })], "New arrivals"));
        break;
      case "offers":
        blocks.push(frame(s, [title("Offers"), n("offers", {})], "Offers"));
        break;
      case "reviews":
        blocks.push(frame(s, [title("What buyers say"), n("testimonials", { source: "reviews", limit: 6 })], "Reviews"));
        break;
      case "html":
        if (design.html?.source) blocks.push(frame(s, [n("custom_html", { name: design.html.name, source: design.html.source, height: design.html.height })], "Custom HTML", { layout: { paddingY: "none", width: "full" } }));
        break;
      case "about":
        blocks.push(frame(s, [n("about", {})], "About"));
        break;
      case "faq":
        blocks.push(frame(s, [title("Questions", { label: "All questions", to: `/s/${slug}/faq` }), n("faq", { source: "store", limit: 5 })], "FAQ", { layout: { width: "narrow" } }));
        break;
      case "newsletter":
        blocks.push(frame(s, [n("newsletter", { heading: design.newsletter.heading.slice(0, 100), body: design.newsletter.body.slice(0, 240) })], "Newsletter", { layout: { width: "normal" } }));
        break;
      case "text":
        if (c.text) blocks.push(frame(s, [n("heading", { text: c.text.heading || "Heading", level: 2, size: "lg" }), n("text", { text: c.text.body, size: "lg" }), ...(c.text.ctaLabel ? [n("button", { label: c.text.ctaLabel, href: href(slug, c.text.ctaTarget), size: "lg" })] : [])], s.title || "Text"));
        break;
      case "columns":
        if (c.columns?.length) blocks.push(frame(s, [...(s.title ? [title(s.title)] : []), n("cards", { columns: Math.min(4, Math.max(2, c.columns.length)) as 2 | 3 | 4, aspect: "none" }, { children: c.columns.slice(0, 12).map((col) => n("card", { title: col.title, text: col.body.slice(0, 600), ctaLabel: col.ctaLabel ?? "", ctaHref: col.ctaLabel ? href(slug, col.ctaTarget) : "" })) })], s.title || "Columns"));
        break;
      case "table":
        if (c.table) blocks.push(frame(s, [...(s.title ? [title(s.title)] : []), n("table", { rows: c.table.rows.slice(0, 30).map((r) => r.slice(0, 8)), header: c.table.header, striped: c.table.striped })], s.title || "Table"));
        break;
      case "marquee":
        if (c.marquee) blocks.push(frame(s, [...(s.title ? [title(s.title)] : []), n("marquee", { mode: c.marquee.mode, items: c.marquee.items.map((it) => ({ text: it.text ?? "", src: it.src ?? "", alt: it.alt ?? "", href: it.href ? href(slug, it.href) : "" })), speed: c.marquee.speed, direction: c.marquee.direction, pauseOnHover: c.marquee.pauseOnHover })], s.title || "Scrolling strip"));
        break;
      case "image":
        if (c.image?.src) blocks.push(frame(s, [n("image", { src: c.image.src, alt: c.image.alt, aspect: c.image.aspect === "3:1" ? "16:9" : c.image.aspect, fit: c.image.fit, caption: c.image.caption ?? "", href: c.image.href ? href(slug, c.image.href) : "" })], "Image"));
        break;
      case "video":
        if (c.video?.src || c.video?.url) blocks.push(frame(s, [n("video", { src: c.video.src || c.video.url || "", poster: c.video.poster ?? "", caption: c.video.caption ?? "" })], "Video"));
        break;
    }
  }
  return { version: 1, blocks: blocks.slice(0, 40) };
}

/**
 * Home pages made before sections had "Background covers" were converted from panels that sat
 * behind the content: their sections without the setting keep that look.
 */
export function upgradeHomeDoc(doc: PageDoc): PageDoc {
  if (!doc.blocks.some((b) => b.type === "section" && !(b.layout as { fill?: string }).fill)) return doc;
  return { ...doc, blocks: doc.blocks.map((b) => (b.type === "section" && !(b.layout as { fill?: string }).fill ? { ...b, layout: { ...b.layout, fill: "content" as const } } : b)) };
}
