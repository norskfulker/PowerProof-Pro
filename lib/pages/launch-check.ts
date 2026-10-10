import { contrast } from "../color";
import { schemesOf } from "../store-themes";
import type { AboutContent, Collection, FaqItem, Product, StorePages, StoreTheme } from "../types";
import type { PageDoc, PageNode } from "./schema";

/**
 * Before a store goes live (or a page is published): what would break for buyers, and what's
 * missing or may look wrong. Pure: everything it needs is passed in.
 *
 * "fix" = buyers would hit something broken (a link to nowhere, a product they can't buy).
 * "check" = it works, but looks unfinished or could be better (an empty picture, default text).
 */
export type IssueLevel = "fix" | "check";

export interface LaunchIssue {
  id: string;
  level: IssueLevel;
  title: string;
  detail: string;
  /** A block on the page to select in the editor */
  nodeId?: string;
  /** Or a place to go and fix it */
  href?: string;
  /** Or an editor panel to open */
  panel?: "content" | "theme" | "pages";
  fixLabel?: string;
}

export interface LaunchInput {
  /** The page being published, as it is in the editor */
  doc: PageDoc;
  /** This page is the home page and the store isn't live yet */
  goingLive: boolean;
  store: { slug: string; name: string; supportEmail: string; logo?: { src: string }; shipping?: { zones: unknown[] } };
  theme: StoreTheme;
  /** Every product, drafts included */
  products: Product[];
  collections: Collection[];
  /** The store's other pages: slug and whether they're published */
  pages: { slug: string; title: string; published: boolean }[];
  about: AboutContent;
  faq: FaqItem[];
  policies?: StorePages;
  reviewCount: number;
  /** A payout method is added */
  payout?: boolean;
  /** Check the theme's colours (going live, or the theme changed) */
  checkColours?: boolean;
  /** Labels for blocks, for the messages */
  label: (n: PageNode) => string;
}

const PLACEHOLDER = /lorem ipsum|\byour [\w ]{0,30}\bhere\b|\badd (a |an |your )(first )?[\w ]{0,30}\b(here|answer)\b|placeholder|^tbd$|^todo\b|\[insert/i;
/** The words a new block starts with (makeNode), left as they were */
const STARTER = new Set(["A headline that says what you sell", "Heading", "Left column", "Right column", "Card 1", "Card 2", "Card 3", "A line or two about this."]);
const unfinished = (w: string) => PLACEHOLDER.test(w) || STARTER.has(w.trim());
/** Text that's missing or still the starter words */
const blank = (w: string | undefined) => !w?.trim() || unfinished(w);

function walk(nodes: PageNode[], fn: (n: PageNode, section?: PageNode) => void, section?: PageNode) {
  for (const n of nodes) {
    const sec = n.type === "section" || n.type === "hero" ? n : section;
    fn(n, sec);
    walk(n.children, fn, sec);
  }
}

const visible = (n: PageNode) => n.visibility.mobile || n.visibility.desktop;

export function launchChecks(input: LaunchInput): LaunchIssue[] {
  const { doc, store, products, collections, pages } = input;
  const out: LaunchIssue[] = [];
  const add = (i: LaunchIssue) => out.push(i);
  const base = `/s/${store.slug}`;
  const live = products.filter((p) => p.status === "published");
  const liveById = new Map(live.map((p) => [p.id, p]));
  const byId = new Map(products.map((p) => [p.id, p]));
  const sections = new Set<string>();
  walk(doc.blocks, (n) => sections.add(`#section-${n.id}`));

  /** Where an internal link goes, or why it can't */
  const linkProblem = (href: string): string | undefined => {
    if (!href) return undefined;
    if (href.startsWith("#")) return sections.has(href) || href === "#" ? undefined : "points to a section that isn't on this page any more";
    if (!href.startsWith("/")) return undefined;
    if (href.startsWith("/s/") && !href.startsWith(`${base}/`) && href !== base) return "points to another store";
    if (!href.startsWith(base)) return undefined;
    const rest = href.slice(base.length).replace(/^\//, "").split(/[?#]/)[0];
    if (!rest || ["products", "about", "faq", "contact", "policies", "policies/refund", "policies/terms", "policies/privacy"].includes(rest)) return undefined;
    const [first, second] = rest.split("/");
    if (first === "c") return collections.some((c) => c.slug === second) ? undefined : "points to a collection that no longer exists";
    if (first === "p") {
      const page = pages.find((p) => p.slug === second);
      if (!page) return "points to a page that no longer exists";
      return page.published ? undefined : `points to "${page.title}", which isn't published`;
    }
    const product = products.find((p) => p.slug === first);
    if (!product) return "points to a product that no longer exists";
    return product.status === "published" ? undefined : `points to "${product.title}", which is a draft`;
  };

  /* The page ---------------------------------------------------------------------------- */
  if (!doc.blocks.some(visible)) add({ id: "page-empty", level: "fix", title: "The page is empty", detail: "Buyers would see a blank page. Add a hero and a few sections.", panel: "pages", fixLabel: "Add a section" });

  walk(doc.blocks, (n, section) => {
    const p = n.props as Record<string, unknown>;
    const where = section && section !== n ? ` (in ${input.label(section)})` : "";
    const at = (id: string, level: IssueLevel, title: string, detail: string) => add({ id: `${id}-${n.id}`, level, title, detail: detail + where, nodeId: n.id, fixLabel: "Show me" });
    if (!visible(n)) return;

    // Links
    const links: [string, string][] = [];
    if (typeof p.href === "string") links.push([String(p.label || p.caption || "A link"), p.href]);
    if (typeof p.linkHref === "string") links.push([String(p.linkLabel || "Link"), p.linkHref]);
    if (typeof p.ctaHref === "string") links.push([String(p.ctaLabel || "Button"), p.ctaHref]);
    if (typeof p.cta2Href === "string") links.push([String(p.cta2Label || "Button"), p.cta2Href]);
    if (Array.isArray(p.items)) (p.items as { href?: string; text?: string }[]).forEach((it) => it.href && links.push([it.text || "Link", it.href]));
    for (const [name, href] of links) {
      const why = linkProblem(href);
      if (why) at("link", "fix", `“${String(name).slice(0, 40)}” goes nowhere`, `It ${why}, so buyers would land on a missing page.`);
    }
    if (n.type === "text" && typeof p.text === "string") {
      for (const m of p.text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
        const why = linkProblem(m[2]);
        if (why) at("textlink", "fix", `The link “${m[1].slice(0, 40)}” goes nowhere`, `It ${why}.`);
      }
    }
    if (n.type === "button" && p.action === "link" && !p.href) at("button-nowhere", "check", `The “${String(p.label).slice(0, 40)}” button does nothing`, "It has no link yet. Choose where it goes.");
    if (n.type === "card" && p.ctaLabel && !p.ctaHref) at("card-cta", "check", `The “${String(p.ctaLabel).slice(0, 40)}” button on a card does nothing`, "It has no link yet.");

    // Products
    if ((n.type === "product_card" || (n.type === "button" && p.action === "product")) && p.productId) {
      const prod = byId.get(String(p.productId));
      if (!prod) at("product-gone", "fix", "A product here was deleted", n.type === "button" ? "The buy button would do nothing. Pick another product." : "Buyers would see an empty space. Pick another product or remove the block.");
      else if (!liveById.has(prod.id)) at("product-draft", "fix", `“${prod.title}” isn't live`, "Buyers can't see or buy drafts. Make it live, or pick another product.");
    }
    if ((n.type === "product_card" || (n.type === "button" && p.action === "product")) && !p.productId) at("product-none", "check", n.type === "button" ? "A buy button has no product" : "A product card has no product", "Pick which product it shows.");
    if (n.type === "product_grid") {
      const ids = (p.productIds as string[]) ?? [];
      const shown = p.source === "manual" ? ids.filter((id) => liveById.has(id)).length : p.source === "collection" ? (collections.find((c) => c.slug === p.collectionSlug)?.productIds.filter((id) => liveById.has(id)).length ?? 0) : live.length;
      if (p.source === "collection" && !collections.some((c) => c.slug === p.collectionSlug)) at("grid-collection", "fix", "A product grid shows a collection that doesn't exist", "Pick another collection, or show all products.");
      else if (!shown) at("grid-empty", "fix", "A product grid would be empty", p.source === "manual" ? "None of its products are live." : p.source === "collection" ? "That collection has no live products yet." : "You have no live products yet.");
      else if (p.source === "manual" && shown < ids.length) at("grid-drafts", "check", "Some products in a grid aren't live", `${ids.length - shown} of ${ids.length} are drafts or deleted, so buyers see only ${shown}.`);
    }
    if (n.type === "collection_list" && !collections.some((c) => c.productIds.some((id) => liveById.has(id)))) at("collections-empty", "fix", "The collections block would be empty", "You have no collections with live products yet.");
    if (n.type === "testimonials" && p.source === "reviews" && input.reviewCount === 0) at("reviews-none", "check", "The reviews block has no reviews yet", "It stays hidden until buyers review you. Write a few quotes yourself, or remove it for now.");
    if (n.type === "testimonials" && p.source === "manual" && !(p.items as unknown[])?.length) at("quotes-none", "check", "The testimonials block is empty", "Add a quote or two, or remove it.");
    const realFaq = (list: { q: string; a: string }[]) => list.filter((f) => !blank(f.q) && !blank(f.a));
    if (n.type === "faq") {
      const list = p.source === "store" ? input.faq : ((p.items as { q: string; a: string }[]) ?? []);
      if (!realFaq(list).length) at("faq-none", "check", list.length ? "The FAQ block shows placeholder questions" : "The FAQ block has no questions", p.source === "store" ? "Your store's FAQ still has the starter question. Write real ones in About & FAQ." : "Add a question or two, or remove it.");
      else if (realFaq(list).length < list.length) at("faq-stub", "check", "A question in the FAQ is still placeholder text", "Replace it or remove it.");
    }
    if (n.type === "about" && blank(input.about.story)) at("about-empty", "check", "The About block has no story yet", input.about.story.trim() ? `It still says “${input.about.story.trim().slice(0, 40)}”. Write a few lines about you in About & FAQ.` : "Write a few lines about you in About & FAQ.");
    if (n.type === "countdown" && p.endsAt && Date.parse(String(p.endsAt)) < Date.now()) at("countdown-over", "fix", "A countdown has already ended", "It would show zero. Set a new end time, or remove it.");
    if (n.type === "countdown" && !p.endsAt) at("countdown-none", "check", "A countdown has no end time", "Set when the offer ends.");

    // Pictures and video
    if (n.type === "image" && !p.src) at("image-none", "check", "An image block has no picture", "It would show an empty box. Add a picture or remove it.");
    if (n.type === "image" && p.src && !String(p.alt ?? "").trim()) at("image-alt", "check", "A picture has no description", "Describe it in a few words for people using screen readers, and for search.");
    if (n.type === "video" && !p.src) at("video-none", "check", "A video block has no video", "Add a video or remove the block.");
    if (n.type === "gallery" && !(p.images as unknown[])?.length) at("gallery-none", "check", "A gallery has no pictures", "Add pictures or remove it.");
    if (n.type === "hero" && !p.image && !(n.style as { background?: { kind?: string } })?.background?.kind?.match(/image|gif|video/)) at("hero-plain", "check", "The hero has no picture", "A picture or video at the top makes the store feel finished. Optional.");
    const bg = (n.style as { background?: { kind?: string; src?: string } }).background;
    if (bg && /image|gif|video/.test(bg.kind ?? "") && !bg.src) at("bg-none", "check", "A background has no picture", "Pick the picture or video, or switch the background to a colour.");

    // Words
    const words = [p.headline, p.title, p.text, p.heading, p.label, p.body].filter((x): x is string => typeof x === "string");
    const stub = words.find(unfinished);
    if (stub) at("placeholder", "check", "Placeholder text is still there", `“${stub.slice(0, 60)}”. Replace it with your own words.`);
    if (n.type === "heading" && !String(p.text ?? "").trim()) at("heading-empty", "check", "A heading is empty", "Write it, or remove the block.");
    if (n.type === "text" && !String(p.text ?? "").trim()) at("text-empty", "check", "A text block is empty", "Write it, or remove the block.");
    if (n.type === "section" && !n.children.some(visible)) at("section-empty", "check", "A section is empty", "It would show as a blank band. Add blocks or remove it.");
  });

  /* Colours ----------------------------------------------------------------------------- */
  if (input.checkColours) for (const s of schemesOf(input.theme)) {
    for (const mode of ["light", "dark"] as const) {
      const c = s[mode];
      const ok = (a: string, b: string, min: number) => { try { return contrast(a, b) >= min; } catch { return true; } };
      if (!ok(c.text, c.background, 4.5)) add({ id: `contrast-text-${s.id}-${mode}`, level: "check", title: `Text is hard to read in “${s.name}”${mode === "dark" ? " (dark mode)" : ""}`, detail: "The text and background colours are too close. Make one lighter or darker.", panel: "theme", fixLabel: "Open colours" });
      if (!ok(c.buttonText, c.button, 3)) add({ id: `contrast-button-${s.id}-${mode}`, level: "check", title: `Button text is hard to read in “${s.name}”${mode === "dark" ? " (dark mode)" : ""}`, detail: "The button and its label are too close in colour.", panel: "theme", fixLabel: "Open colours" });
    }
  }

  /* The store (only when it's about to go live) ---------------------------------------- */
  if (input.goingLive) {
    if (!live.length) add({ id: "no-products", level: "fix", title: "Nothing to buy yet", detail: products.length ? `You have ${products.length} draft${products.length === 1 ? "" : "s"}. Make at least one live so buyers can buy.` : "Add a product and make it live.", href: products.length ? "/catalog/products?status=draft" : "/catalog/products/new", fixLabel: products.length ? "See drafts" : "Add a product" });
    if (live.some((p) => p.fulfilment === "physical") && !store.shipping?.zones.length) add({ id: "no-shipping", level: "fix", title: "Shipped products can't be bought yet", detail: "Set where you ship and what it costs, or buyers can't check out.", href: "/store/current/settings", fixLabel: "Set up shipping" });
    const noPic = live.filter((p) => !p.images.some((i) => i.src || i.cover));
    if (noPic.length) add({ id: "products-no-picture", level: "check", title: `${noPic.length} live product${noPic.length === 1 ? " has" : "s have"} no picture`, detail: noPic.slice(0, 3).map((p) => p.title).join(", ") + (noPic.length > 3 ? "…" : ""), href: `/catalog/products/${noPic[0].id}`, fixLabel: "Add pictures" });
    const noFile = live.filter((p) => p.fulfilment === "digital" && !p.files.length);
    if (noFile.length) add({ id: "products-no-file", level: "fix", title: `${noFile.length} download${noFile.length === 1 ? " has" : "s have"} no file`, detail: `Buyers would pay and get nothing: ${noFile.slice(0, 3).map((p) => p.title).join(", ")}.`, href: `/catalog/products/${noFile[0].id}`, fixLabel: "Upload the file" });
    if (!store.logo?.src) add({ id: "no-logo", level: "check", title: "No logo yet", detail: "Your store's initials show instead. Add a logo in the theme settings.", panel: "theme", fixLabel: "Add a logo" });
    if (!store.supportEmail.trim()) add({ id: "no-email", level: "check", title: "No support email", detail: "Buyers can't reach you about an order. Add one in Settings.", href: "/store/current/settings", fixLabel: "Add an email" });
    if (blank(input.about.story)) add({ id: "no-about", level: "check", title: input.about.story.trim() ? "Your About page is still the starter text" : "Your About page is empty", detail: "A few lines about you helps buyers trust a new store.", panel: "content", fixLabel: "Write it" });
    const pol = input.policies;
    if (pol?.edited) {
      const name = (k: "refund" | "terms" | "privacy") => (k === "refund" ? "refund policy" : k === "terms" ? "terms" : "privacy policy");
      const and = (l: string[]) => l.join(", ").replace(/, ([^,]*)$/, " and $1");
      // A one-line stub ("Add your terms here.") is worse than the default wording: buyers see nothing real
      const stubs = (["refund", "terms", "privacy"] as const).filter((k) => blank(pol[k]) || pol[k].trim().length < 60);
      if (stubs.length) add({ id: "policies-stub", level: "check", title: `Your ${and(stubs.map(name))} ${stubs.length === 1 ? "is" : "are"} only placeholder text`, detail: "Buyers can open these from every page. Write a few real lines; the policy pages have a starting point you can use.", href: `/store/current/pages/policies/${stubs[0]}`, fixLabel: "Write them" });
      const unedited = (["refund", "terms", "privacy"] as const).filter((k) => !pol.edited?.[k] && !stubs.includes(k));
      if (unedited.length) add({ id: "policies-default", level: "check", title: `Your ${and(unedited.map(name))} ${unedited.length === 1 ? "is" : "are"} still the default text`, detail: "It's a fair starting point. Read it and make it yours.", href: `/store/current/pages/policies/${unedited[0]}`, fixLabel: "Read them" });
    }
    if (input.payout === false) add({ id: "no-payout", level: "check", title: "No payout method yet", detail: "You can sell now, but we can't send your earnings until you add a bank account or UPI ID.", href: "/sales/payouts/methods", fixLabel: "Add one" });
  }

  // Must-fix first, then by where they are on the page
  return out.sort((a, b) => Number(a.level === "check") - Number(b.level === "check"));
}
