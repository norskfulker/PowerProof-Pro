import * as z from "zod/v4";
import { contrast, normalizeHex } from "../color";
import { FONT_PAIRS, PALETTES, schemesOf } from "../store-themes";
import type { ColorScheme, StoreTheme } from "../types";
import { makeNode, pageDocSchema, type Background, type PageDoc, type PageNode } from "./schema";

/**
 * The AI page builder (shared by the server route and the editor).
 *
 * The page format is a recursive tree, which structured tool inputs can't describe, so the AI fills
 * flat shapes instead: a hero, or a section with a list of blocks (cards and image-with-text cover
 * the side-by-side layouts). The server turns each one into real page blocks with `aiSectionToNode`,
 * which also checks every link, picture and product against the store, so nothing the AI makes up
 * reaches a page.
 */

/* ------------------------------------------------------------------ */
/* Page types                                                           */
/* ------------------------------------------------------------------ */

/** The page types AI can build: the store's home page and every page template */
export const AI_PAGE_TYPES = [
  { id: "home", name: "Home page", guide: "The store's front page. Open with a hero for the store, then trust points (highlights, automatic), the products (bestsellers grid), collections if there are any, a short story or about section, reviews (only if the store has some), FAQ from the store, and a newsletter sign-up. 6 to 9 sections." },
  { id: "launch", name: "Launch page", guide: "One product, front and centre. Hero with that product's picture and a buy button, what's inside (cards or highlights), who it's for, the product card to buy, reviews if any, FAQ. 5 to 7 sections." },
  { id: "sale", name: "Sale page", guide: "A time-limited offer. Hero with the offer, a countdown, the products on sale in a grid, why buy now (highlights), FAQ, and a closing call to action. 5 to 7 sections." },
  { id: "bio", name: "Link in bio", guide: "Phone-first and short. A small intro (heading and one line), then a column of large buttons to the store's best places (products, collections, pages), maybe a newsletter. 2 to 4 sections, narrow width, centred." },
  { id: "lead", name: "Lead generation", guide: "Offer something free in exchange for a name and email. Hero with the promise, what they'll get (cards), the lead form, and a few questions. 4 to 6 sections. Must include a lead_form block." },
  { id: "squeeze", name: "Squeeze page", guide: "One promise, one form, nothing else to click. A short headline section and the lead form, perhaps 3 bullet points. 1 to 3 sections, narrow and centred. Must include a lead_form block." },
  { id: "booking", name: "Book a call", guide: "Visitors book a time. Short intro about the call, the booking calendar, what happens on the call, FAQ. 3 to 5 sections. Must include a booking block." },
  { id: "clickthrough", name: "Click-through page", guide: "Warm people up, then one button to the offer. Hero, three reasons (cards or highlights), proof (reviews if any), and a final button section. 4 to 5 sections." },
  { id: "blank", name: "Custom page", guide: "Whatever the creator describes. Choose sensible sections for their goal. 3 to 8 sections." },
] as const;
export type AiPageType = (typeof AI_PAGE_TYPES)[number]["id"];
export const aiPageType = (id: string) => AI_PAGE_TYPES.find((t) => t.id === id) ?? AI_PAGE_TYPES[AI_PAGE_TYPES.length - 1];

/** Languages offered in the brief; the AI writes every word buyers see in the chosen one */
export const AI_LANGUAGES = ["English", "Hindi", "Bengali", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Gujarati", "Punjabi", "Urdu", "Spanish", "French", "German", "Portuguese", "Arabic", "Indonesian", "Japanese"] as const;

/** What the creator asks for */
export const aiBriefSchema = z.strictObject({
  pageType: z.enum(AI_PAGE_TYPES.map((t) => t.id) as [AiPageType, ...AiPageType[]]),
  /** What the page is for, in the creator's words */
  description: z.string().trim().min(10, "Say a little more about what the page is for.").max(2000),
  audience: z.string().trim().max(300).default(""),
  tone: z.enum(["friendly", "professional", "bold", "playful", "calm", "luxury"]).default("friendly"),
  language: z.string().trim().min(2).max(40).default("English"),
  /** Products to feature; empty means the AI picks */
  productIds: z.array(z.string().max(64)).max(24).default([]),
  /** Also design colours, fonts, schemes and the announcement bar (as a draft) */
  theme: z.boolean().default(true),
  /** Replace the page, or add the new sections after what's there */
  mode: z.enum(["replace", "append"]).default("replace"),
});
export type AiBrief = z.infer<typeof aiBriefSchema>;

/** What the run sends to the editor, one JSON object per line */
export type AiEvent =
  | { type: "status"; text: string }
  | { type: "section"; node: PageNode }
  | { type: "theme"; theme: StoreTheme; announcement: string; seo: { title: string; description: string } }
  | { type: "note"; text: string }
  | { type: "done"; sections: number; summary: string }
  | { type: "error"; message: string };

/* ------------------------------------------------------------------ */
/* What the AI fills in                                                 */
/* ------------------------------------------------------------------ */

const target = z
  .string()
  .max(120)
  .describe('Where it goes: "products", "home", "about", "faq", "contact", "collection:<slug>", "product:<slug>", "section:<n>" (the nth section of this page, counting from 1), or a full https:// address the creator gave you. Empty for nowhere.');
const picture = z.string().max(80).describe('A picture from the pictures list ("pic:<n>"), or "" for none. Never invent pictures.');
const video = z.string().max(300).describe('A video from the videos list ("vid:<n>"), or a YouTube or Vimeo https link the creator gave in the brief; "" for none.');
const icon = z.string().max(40).describe('An icon name from the icon list, like "Truck", "ShieldCheck", "Lightning", or "" for none.');
const words = (max: number, what: string) => z.string().max(max).describe(what);
const align = z.enum(["", "left", "center", "right"]).describe('This block\'s own alignment; "" follows the section (or column)');
const shape = z.enum(["4:3", "1:1", "16:9", "3:4"]).describe("Frame shape. Match the picture: landscape 4:3 or 16:9, square 1:1, portrait 3:4");

/** Blocks that can also sit inside a column */
const simpleBlocks = [
  z.strictObject({ type: z.literal("heading"), text: words(160, "The heading"), size: z.enum(["sm", "md", "lg", "xl"]), linkLabel: words(40, 'Optional link on the right, like "View all"; "" for none'), linkTarget: target, align }),
  z.strictObject({ type: z.literal("text"), text: words(4000, "Paragraphs separated by a blank line. **bold**, _italic_ and [link text](target) work."), size: z.enum(["sm", "md", "lg"]), align }),
  z.strictObject({ type: z.literal("button"), label: words(40, "Button label"), target, style: z.enum(["primary", "secondary", "brass"]), size: z.enum(["sm", "md", "lg"]), align }),
  z.strictObject({ type: z.literal("image"), picture, alt: words(200, "What the picture shows"), shape, caption: words(200, "Optional caption"), align }),
  z.strictObject({ type: z.literal("video"), video, poster: picture.describe('A still shown before it plays ("pic:<n>"), or "" (an uploaded video uses its own)'), shape: z.enum(["16:9", "4:3", "1:1", "9:16"]), autoplay: z.boolean().describe("Plays muted on a loop; for short clips only"), caption: words(200, "Optional caption"), align }),
] as const;

const block = z.discriminatedUnion("type", [
  ...simpleBlocks,
  z.strictObject({
    type: z.literal("image_with_text"),
    picture,
    video: video.describe('A video instead of the picture ("vid:<n>" or a YouTube/Vimeo link), or ""'),
    alt: words(200, "What the picture shows"),
    shape,
    side: z.enum(["left", "right"]).describe("Which side the picture is on. Alternate it down the page"),
    ratio: z.enum(["equal", "media-wider", "words-wider"]),
    eyebrow: words(60, 'Small line above the heading, "" for none'),
    heading: words(160, "Heading"),
    text: words(1200, "A few lines"),
    buttonLabel: words(40, '"" for no button'),
    buttonTarget: target,
  }),
  z.strictObject({
    type: z.literal("columns"),
    ratio: z.enum(["equal", "2:1", "1:2"]).describe('Widths of two columns; "equal" for three'),
    columns: z.array(z.strictObject({ align: z.enum(["left", "center", "right"]), blocks: z.array(z.discriminatedUnion("type", [...simpleBlocks])).min(1).max(5) })).min(2).max(3).describe("2 or 3 columns side by side (stacked on phones)"),
  }),
  z.strictObject({
    type: z.literal("cards"),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    look: z.enum(["card", "plain"]),
    shape,
    align: z.enum(["left", "center"]),
    cards: z.array(z.strictObject({ icon, picture, title: words(120, "Card title"), text: words(600, "A line or two"), linkLabel: words(40, '"" for no link'), linkTarget: target })).min(1).max(8),
  }),
  z.strictObject({ type: z.literal("gallery"), pictures: z.array(picture).min(2).max(12), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]) }),
  z.strictObject({ type: z.literal("table"), rows: z.array(z.array(words(200, "Cell"))).min(2).max(12).describe("First row is the header. Up to 6 columns."), striped: z.boolean() }),
  z.strictObject({
    type: z.literal("highlights"),
    source: z.enum(["auto", "manual"]).describe('"auto" shows instant download, secure payment, the refund window and the real rating; "manual" uses the items'),
    look: z.enum(["strip", "cards"]),
    items: z.array(z.strictObject({ icon, title: words(60, "Short point"), body: words(160, "One line") })).max(6),
  }),
  z.strictObject({ type: z.literal("product_grid"), show: z.enum(["picked", "popular", "newest", "all"]), productIds: z.array(z.string().max(64)).max(12).describe('For "picked": product ids from the store data'), limit: z.number().int(), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]) }),
  z.strictObject({ type: z.literal("product_card"), productId: z.string().max(64) }),
  z.strictObject({ type: z.literal("collection_list") }),
  z.strictObject({ type: z.literal("offers") }),
  z.strictObject({ type: z.literal("about") }),
  z.strictObject({ type: z.literal("reviews"), limit: z.number().int().describe("1 to 6. Only real reviews are shown, so use this only when the store has reviews.") }),
  z.strictObject({ type: z.literal("faq"), source: z.enum(["store", "manual"]), items: z.array(z.strictObject({ q: words(200, "Question"), a: words(1000, "Answer") })).max(10) }),
  z.strictObject({ type: z.literal("countdown"), endsAt: words(40, "When the offer ends, ISO 8601 with time zone"), label: words(80, 'Like "Offer ends in"') }),
  z.strictObject({ type: z.literal("newsletter"), heading: words(100, "Heading"), body: words(240, "One line") }),
  z.strictObject({ type: z.literal("marquee"), items: z.array(words(80, "A short phrase")).max(8), logos: z.array(picture).max(12).describe("Pictures of logos to scroll instead of words; [] for words") }),
  z.strictObject({
    type: z.literal("lead_form"),
    heading: words(100, "Heading"),
    body: words(240, "One line"),
    fields: z.array(z.strictObject({ label: words(60, "Field label"), type: z.enum(["text", "email", "phone", "textarea"]), required: z.boolean() })).min(1).max(5).describe("Must include an email field"),
    buttonLabel: words(40, "Button label"),
    successMessage: words(240, "Shown after sending"),
  }),
  z.strictObject({ type: z.literal("booking"), heading: words(100, "Heading"), body: words(240, "One line"), durationMin: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]), days: z.array(z.number().int()).max(7).describe("0 = Sunday … 6 = Saturday"), startHour: z.number().int(), endHour: z.number().int(), buttonLabel: words(40, "Button label") }),
  z.strictObject({ type: z.literal("spacer"), size: z.enum(["sm", "md", "lg", "xl"]) }),
  z.strictObject({ type: z.literal("divider") }),
]);
export type AiBlock = z.infer<typeof block>;
type AiSimpleBlock = z.infer<(typeof simpleBlocks)[number]>;

const hexOrNone = z.string().max(9).describe('A colour like #1E2A4A, or ""');
const backgroundInput = z
  .strictObject({
    kind: z.enum(["none", "picture", "video", "color", "gradient"]).describe('"none" uses the scheme colours. "picture"/"video" fill the section behind the words'),
    picture: picture.describe('For "picture": "pic:<n>". For "video": a still shown on phones, or ""'),
    video: z.string().max(40).describe('For "video": an uploaded video "vid:<n>" (not a YouTube link); otherwise ""'),
    color: hexOrNone.describe('For "color", or the first colour of "gradient"'),
    color2: hexOrNone.describe('The second colour of "gradient"'),
    overlay: z.number().int().describe("0 to 70: how much a dark (or light) layer covers a picture or video so words stay readable. 40 to 60 for busy pictures"),
    text: z.enum(["auto", "light", "dark"]).describe('Text colour over the background; "light" over dark pictures'),
  })
  .describe("What sits behind the section");

const sectionLook = {
  scheme: z.string().max(40).describe('A colour scheme id ("scheme-1" … "scheme-5", or one you defined with set_theme), or "" for the page colour'),
  fill: z.enum(["full", "content"]).describe('"content" puts the colours on a rounded panel behind the content; "full" across the whole width'),
  align: z.enum(["left", "center", "right"]).describe("How the section's blocks line up"),
  width: z.enum(["narrow", "normal", "wide", "full"]).describe("narrow for reading and forms, normal, wide for grids and cards, full edge to edge"),
  space: z.enum(["sm", "md", "lg", "xl"]).describe("Space above and below"),
  height: z.enum(["auto", "sm", "md", "lg", "screen"]).describe('"auto" fits the content; taller for picture backgrounds and heroes'),
  gap: z.enum(["sm", "md", "lg"]).describe("Space between blocks"),
  background: backgroundInput,
};

export const aiSectionSchema = z.strictObject({
  label: words(60, "A short name for the section, only the creator sees it"),
  ...sectionLook,
  blocks: z.array(block).min(1).max(8),
});
export type AiSection = z.infer<typeof aiSectionSchema>;

export const aiHeroSchema = z.strictObject({
  eyebrow: words(60, 'Small line above the headline, "" for none'),
  headline: words(120, "The headline"),
  subtext: words(300, "One or two lines under it"),
  buttonLabel: words(40, '"" for no button'),
  buttonTarget: target,
  secondButtonLabel: words(40, '"" for none'),
  secondButtonTarget: target,
  pictures: z.array(z.string().max(80)).max(3).describe('Up to 3 pictures ("pic:<n>") beside the words when layout is "split"; the first is the big one. [] for words only. For a picture behind the words use background instead.'),
  layout: z.enum(["left", "centered", "split"]).describe('"split" puts the pictures beside the words; "left" or "centered" for words only or over a background picture'),
  ...sectionLook,
});
export type AiHero = z.infer<typeof aiHeroSchema>;

const hex = z.string().max(9).describe("A colour like #1E2A4A");
const schemeColors = z.strictObject({ background: hex, text: hex, button: hex, buttonText: hex, border: hex });

export const aiThemeSchema = z.strictObject({
  palette: z.enum(PALETTES.map((p) => p.id) as [string, ...string[]]),
  brand: hex.describe("The main colour: buttons and links"),
  accent: hex,
  fonts: z.enum(FONT_PAIRS.map((f) => f.id) as [string, ...string[]]).describe("modern, editorial (serif headings) or clean"),
  corners: z.enum(["sharp", "soft", "round"]),
  mode: z.enum(["light", "dark", "auto"]),
  schemes: z.array(z.strictObject({ id: z.string().max(20).describe('"scheme-1" … "scheme-6"'), name: words(30, "Name"), light: schemeColors, dark: schemeColors })).min(3).max(6).describe("Text must read on its background (4.5:1) and button labels on buttons, in both light and dark"),
  announcement: words(80, 'Text for the bar above the menu, "" to hide it'),
  seoTitle: words(70, "Page title for search engines"),
  seoDescription: words(160, "Page description for search engines"),
});
export type AiTheme = z.infer<typeof aiThemeSchema>;

/** Keywords strict tool schemas don't take; zod checks them on the server instead */
const UNSUPPORTED = new Set(["$schema", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "pattern", "maxItems"]);
function strictSafe(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSafe);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (UNSUPPORTED.has(k)) continue;
    // Only "at least one" is supported for array lengths
    if (k === "minItems" && typeof v === "number" && v > 1) continue;
    out[k] = strictSafe(v);
  }
  return out;
}

/** The tools the AI builds the page with, as JSON schema (strict: no extra fields anywhere) */
export function aiToolSchemas() {
  const json = (s: z.ZodType) => strictSafe(z.toJSONSchema(s, { target: "draft-7", unrepresentable: "any" })) as Record<string, unknown>;
  return {
    add_hero: json(aiHeroSchema),
    add_section: json(aiSectionSchema),
    set_theme: json(aiThemeSchema),
  };
}

/* ------------------------------------------------------------------ */
/* From the AI's shapes to page blocks, checked against the store       */
/* ------------------------------------------------------------------ */

/** What the AI may point at: the store's own things, by id and slug */
export interface AiStoreFacts {
  slug: string;
  products: { id: string; slug: string }[];
  collections: { slug: string }[];
  /** Ids the page's sections get, in order, so "section:<n>" links resolve */
  sectionIds: (n: number) => string;
  hasReviews: boolean;
  /** The pictures ("pic:<n>") and videos ("vid:<n>") the AI was shown, and where each really is */
  media?: AiMedia[];
}

export interface AiMedia {
  ref: string;
  kind: "image" | "video";
  /** A page media source: "product:<id>" or an https URL */
  src: string;
  /** Videos: the still shown before playing */
  poster?: string;
}

export class AiInputError extends Error {}

function hrefOf(t: string, f: AiStoreFacts): string {
  const v = t.trim();
  if (!v) return "";
  const base = `/s/${f.slug}`;
  if (v === "home") return base;
  if (v === "products") return `${base}/products`;
  if (v === "about" || v === "faq" || v === "contact") return `${base}/${v}`;
  if (v.startsWith("collection:")) {
    if (!f.collections.some((c) => c.slug === v.slice(11))) throw new AiInputError(`There's no collection "${v.slice(11)}". Use a slug from the store data.`);
    return `${base}/c/${v.slice(11)}`;
  }
  if (v.startsWith("product:")) {
    const p = f.products.find((x) => x.slug === v.slice(8) || x.id === v.slice(8));
    if (!p) throw new AiInputError(`There's no product "${v.slice(8)}". Use a slug from the store data.`);
    return `${base}/${p.slug}`;
  }
  if (v.startsWith("section:")) {
    const n = Number(v.slice(8));
    if (!Number.isInteger(n) || n < 1 || n > 40) throw new AiInputError(`"${v}" isn't a section number.`);
    return `#section-${f.sectionIds(n)}`;
  }
  if (/^https:\/\/[^\s]+$/i.test(v) && v.length <= 500) return v;
  if (/^mailto:[^\s]+$/i.test(v)) return v;
  throw new AiInputError(`"${v}" isn't a place a link can go. Use products, home, about, faq, contact, collection:<slug>, product:<slug>, section:<n> or an https:// address.`);
}

function pictureOf(p: string, f: AiStoreFacts): string {
  const v = p.trim();
  if (!v) return "";
  if (v.startsWith("pic:")) {
    const m = f.media?.find((x) => x.ref === v && x.kind === "image");
    if (m) return m.src;
  }
  if (v.startsWith("product:") && f.products.some((x) => x.id === v.slice(8))) return v;
  throw new AiInputError(`"${v}" isn't in the pictures list. Use "pic:<n>" from the list, or "".`);
}

const EMBED = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?|shorts\/|embed\/)|youtu\.be\/|vimeo\.com\/\d)/i;

/** A video from the list, or a YouTube/Vimeo link; `file` says it's an uploaded file (which can be a background) */
function videoOf(v: string, f: AiStoreFacts): { src: string; poster: string; file: boolean } {
  const t = v.trim();
  if (!t) return { src: "", poster: "", file: false };
  if (t.startsWith("vid:")) {
    const m = f.media?.find((x) => x.ref === t && x.kind === "video");
    if (m) return { src: m.src, poster: m.poster ?? "", file: true };
  }
  if (EMBED.test(t) && t.length <= 300) return { src: t, poster: "", file: false };
  throw new AiInputError(`"${t}" isn't a video you can use. Use "vid:<n>" from the videos list, a YouTube or Vimeo link from the brief, or "".`);
}

const productId = (id: string, f: AiStoreFacts) => {
  if (!f.products.some((p) => p.id === id)) throw new AiInputError(`There's no product with id "${id}".`);
  return id;
};

const iconName = (v: string) => (/^[A-Za-z]{1,40}$/.test(v) ? v : "");
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
const SPACE = { sm: "sm", md: "md", lg: "lg", xl: "xl" } as const;

const own = (a: string) => ({ style: { selfAlign: (a === "left" || a === "center" || a === "right" ? a : "") as "" | "left" | "center" | "right" } });

function simpleNodes(b: AiSimpleBlock, f: AiStoreFacts): PageNode[] {
  switch (b.type) {
    case "heading":
      return [makeNode("heading", { text: b.text || "Heading", level: 2, size: b.size, linkLabel: b.linkLabel, linkHref: b.linkLabel ? hrefOf(b.linkTarget, f) : "" }, own(b.align))];
    case "text":
      return b.text.trim() ? [makeNode("text", { text: b.text, size: b.size }, own(b.align))] : [];
    case "button":
      return [makeNode("button", { label: b.label || "Shop now", href: hrefOf(b.target, f) || `/s/${f.slug}/products`, variant: b.style, size: b.size }, own(b.align))];
    case "image": {
      const src = pictureOf(b.picture, f);
      return src ? [makeNode("image", { src, alt: b.alt, aspect: b.shape, caption: b.caption }, own(b.align))] : [];
    }
    case "video": {
      const v = videoOf(b.video, f);
      if (!v.src) return [];
      return [makeNode("video", { src: v.src, poster: pictureOf(b.poster, f) || v.poster, aspect: b.shape, autoplay: b.autoplay && v.file, caption: b.caption }, own(b.align))];
    }
  }
}

function blockNodes(b: AiBlock, f: AiStoreFacts): PageNode[] {
  switch (b.type) {
    case "heading":
    case "text":
    case "button":
    case "image":
    case "video":
      return simpleNodes(b, f);
    case "image_with_text": {
      const v = videoOf(b.video, f);
      const src = pictureOf(b.picture, f);
      const media = v.src
        ? makeNode("video", { src: v.src, poster: src || v.poster, aspect: b.shape === "3:4" ? "4:3" : b.shape === "1:1" ? "1:1" : "16:9" })
        : src
          ? makeNode("image", { src, alt: b.alt, aspect: b.shape })
          : undefined;
      const words = [
        ...(b.eyebrow ? [makeNode("text", { text: `**${b.eyebrow}**`, size: "sm" })] : []),
        makeNode("heading", { text: b.heading || "Heading", level: 2, size: "lg" }),
        ...(b.text.trim() ? [makeNode("text", { text: b.text })] : []),
        ...(b.buttonLabel ? [makeNode("button", { label: b.buttonLabel, href: hrefOf(b.buttonTarget, f) || `/s/${f.slug}/products` })] : []),
      ];
      // No picture or video: just the words
      if (!media) return words;
      const pic = makeNode("column", {}, { children: [media] });
      const text = makeNode("column", {}, { style: { align: "left" }, children: words });
      const mediaFirst = b.side === "left";
      const wide = b.ratio === "media-wider" ? (mediaFirst ? "2:1" : "1:2") : b.ratio === "words-wider" ? (mediaFirst ? "1:2" : "2:1") : "equal";
      return [makeNode("columns", { ratio: wide, valign: "center" }, { children: mediaFirst ? [pic, text] : [text, pic] })];
    }
    case "columns": {
      // Headings in a column sit under the section's own heading: no bigger than medium
      const sized = (x: AiSimpleBlock): AiSimpleBlock => (x.type === "heading" && (x.size === "lg" || x.size === "xl") ? { ...x, size: "md" } : x);
      const cols = b.columns.slice(0, 3).map((c) => makeNode("column", {}, { style: { align: c.align }, children: c.blocks.flatMap((x) => simpleNodes(sized(x), f)) }));
      if (cols.some((c) => !c.children.length)) throw new AiInputError("A column ended up empty (a picture or video that isn't in the lists?). Give every column something to show.");
      return [makeNode("columns", { ratio: cols.length === 2 ? b.ratio : "equal", valign: "start" }, { children: cols })];
    }
    case "cards": {
      const withPictures = b.cards.some((c) => c.picture);
      return [
        makeNode("cards", { columns: b.columns, look: b.look, aspect: withPictures ? b.shape : "none" }, {
          style: { selfAlign: b.align === "center" ? "center" : "left" },
          children: b.cards.map((c) => makeNode("card", { icon: iconName(c.icon), image: pictureOf(c.picture, f), title: c.title, text: c.text, ctaLabel: c.linkLabel, ctaHref: c.linkLabel ? hrefOf(c.linkTarget, f) : "" })),
        }),
      ];
    }
    case "gallery": {
      const images = b.pictures.map((x) => pictureOf(x, f)).filter(Boolean).slice(0, 12).map((src) => ({ src, alt: "" }));
      if (images.length < 2) throw new AiInputError("A gallery needs at least two pictures from the list.");
      return [makeNode("gallery", { images, columns: b.columns })];
    }
    case "table":
      return [makeNode("table", { rows: b.rows.slice(0, 12).map((r) => r.slice(0, 6)), header: true, striped: b.striped })];
    case "highlights":
      return [makeNode("highlights", b.source === "auto" || !b.items.length ? { source: "auto", look: b.look } : { source: "manual", look: b.look, items: b.items.map((i) => ({ icon: iconName(i.icon) || "Check", title: i.title, body: i.body })) })];
    case "product_grid":
      return [
        makeNode("product_grid", {
          source: b.show === "picked" ? "manual" : "all",
          productIds: b.show === "picked" ? b.productIds.map((id) => productId(id, f)) : [],
          sort: b.show === "popular" ? "popular" : b.show === "newest" ? "newest" : "featured",
          limit: clamp(b.limit, 1, 24),
          columns: b.columns,
        }),
      ];
    case "product_card":
      return [makeNode("product_card", { productId: productId(b.productId, f), showBuy: true })];
    case "collection_list":
      return [makeNode("collection_list", {})];
    case "offers":
      return [makeNode("offers", {})];
    case "about":
      return [makeNode("about", {})];
    case "reviews":
      // Only the store's real reviews: nothing to show means nothing to add
      return f.hasReviews ? [makeNode("testimonials", { source: "reviews", limit: clamp(b.limit, 1, 6) })] : [];
    case "faq":
      return [makeNode("faq", b.source === "store" || !b.items.length ? { source: "store", limit: 6 } : { source: "manual", items: b.items })];
    case "countdown": {
      const at = Date.parse(b.endsAt);
      return [makeNode("countdown", { endsAt: Number.isNaN(at) ? "" : new Date(at).toISOString(), label: b.label })];
    }
    case "newsletter":
      return [makeNode("newsletter", { heading: b.heading, body: b.body })];
    case "marquee": {
      const logos = b.logos.map((x) => pictureOf(x, f)).filter(Boolean);
      if (logos.length >= 2) return [makeNode("marquee", { mode: "logos", items: logos.map((src) => ({ src, alt: "" })) })];
      const items = b.items.filter((t) => t.trim());
      if (items.length < 2) throw new AiInputError("Scrolling words need at least two phrases (or two logo pictures).");
      return [makeNode("marquee", { items: items.map((text) => ({ text })) })];
    }
    case "lead_form": {
      const used = new Set<string>();
      const fields = b.fields.map((fl, i) => {
        let id = fl.type === "email" ? "email" : fl.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) || `field_${i + 1}`;
        while (used.has(id)) id = `${id.slice(0, 18)}_${i}`;
        used.add(id);
        return { id, label: fl.label || "Your answer", type: fl.type, required: fl.required };
      });
      if (!fields.some((x) => x.type === "email")) fields.push({ id: "email", label: "Email", type: "email", required: true });
      return [makeNode("lead_form", { heading: b.heading, body: b.body, fields: fields.slice(0, 6), buttonLabel: b.buttonLabel || "Send", successMessage: b.successMessage || "Thanks! We'll be in touch." })];
    }
    case "booking": {
      const start = clamp(b.startHour, 0, 22);
      return [makeNode("booking", { heading: b.heading, body: b.body, durationMin: b.durationMin, days: [...new Set(b.days.filter((d) => d >= 0 && d <= 6))].length ? [...new Set(b.days.filter((d) => d >= 0 && d <= 6))] : [1, 2, 3, 4, 5], startHour: start, endHour: Math.max(start + 1, clamp(b.endHour, 1, 24)), buttonLabel: b.buttonLabel || "Book this time" })];
    }
    case "spacer":
      return [makeNode("spacer", { size: b.size })];
    case "divider":
      return [makeNode("divider", {})];
  }
}

type AiBackground = z.infer<typeof backgroundInput>;

/** The AI's background as the page's, kept readable: words over a picture always get a layer under them */
function backgroundOf(bg: AiBackground, f: AiStoreFacts) {
  const tone = bg.text;
  if (bg.kind === "picture" || bg.kind === "video") {
    let background: Background;
    if (bg.kind === "video") {
      const v = videoOf(bg.video, f);
      if (!v.file) throw new AiInputError('A video background needs an uploaded video ("vid:<n>"). Use a video block for YouTube or Vimeo.');
      background = { kind: "video", src: v.src, poster: pictureOf(bg.picture, f) || v.poster, focal: { x: 50, y: 50 } };
    } else {
      const src = pictureOf(bg.picture, f);
      if (!src) throw new AiInputError('A picture background needs a picture ("pic:<n>").');
      background = { kind: "image", src, alt: "", focal: { x: 50, y: 50 } };
    }
    const dark = tone === "dark";
    return { background, overlay: Math.max(clamp(bg.overlay, 0, 70) / 100, dark ? 0.55 : 0.35), overlayColor: dark ? "#FFFFFF" : "#000000", tone: dark ? ("dark" as const) : ("light" as const) };
  }
  if (bg.kind === "color") {
    const c = normalizeHex(bg.color);
    return c ? { background: { kind: "solid", color: c } as Background, tone } : { background: { kind: "none" } as Background, tone: "auto" as const };
  }
  if (bg.kind === "gradient") {
    const a = normalizeHex(bg.color);
    const b = normalizeHex(bg.color2) ?? a;
    return a && b ? { background: { kind: "gradient", from: a, to: b, angle: 135 } as Background, tone } : { background: { kind: "none" } as Background, tone: "auto" as const };
  }
  return { background: { kind: "none" } as Background, tone: "auto" as const };
}

type Look = Pick<AiSection, "scheme" | "fill" | "align" | "width" | "space" | "height" | "gap" | "background">;

function lookOf(s: Look, schemeIds: string[], f: AiStoreFacts) {
  const scheme = s.scheme && schemeIds.includes(s.scheme) ? s.scheme : "";
  return {
    style: { scheme, align: s.align, ...backgroundOf(s.background, f) },
    layout: { paddingY: SPACE[s.space], width: s.width, minHeight: s.height, gap: s.gap, fill: s.fill },
  };
}

const WIDE_BLOCKS = new Set(["cards", "product_grid", "collection_list", "gallery", "columns", "offers"]);
const TEXT_BLOCKS = new Set(["heading", "text", "button", "divider", "spacer"]);

/**
 * A designer's last look at a section: grids get room, reading text keeps a comfortable line,
 * forms don't stretch, and a centred section's long paragraphs read from the left.
 */
function polish(node: PageNode, f: AiStoreFacts): PageNode {
  const layout = { ...node.layout };
  const style = { ...node.style };
  // Grids sized to what they hold: one product is a product card, two sit in two columns
  const kids = node.children.map((k): PageNode => {
    if (k.type === "product_grid") {
      const p = k.props as { source: string; productIds: string[]; limit: number; columns: 2 | 3 | 4 };
      const ids = p.source === "manual" ? p.productIds : f.products.slice(0, p.limit).map((x) => x.id);
      if (ids.length === 1) return makeNode("product_card", { productId: ids[0], showBuy: true }, { id: k.id });
      if (ids.length && ids.length < p.columns) return { ...k, props: { ...p, columns: Math.max(2, ids.length) as 2 | 3 } as PageNode["props"] };
    }
    if (k.type === "cards") {
      const p = k.props as { columns: 2 | 3 | 4 };
      if (k.children.length < p.columns) return { ...k, props: { ...p, columns: Math.max(2, k.children.length) as 2 | 3 } as PageNode["props"] };
    }
    if (k.type === "gallery") {
      const p = k.props as { columns: 2 | 3 | 4; images: unknown[] };
      if (p.images.length < p.columns) return { ...k, props: { ...p, columns: Math.max(2, p.images.length) as 2 | 3 } as PageNode["props"] };
    }
    return k;
  });
  const small = kids.some((k) => k.type === "product_card") && !kids.some((k) => WIDE_BLOCKS.has(k.type));
  if (small && (layout.width === "wide" || layout.width === "full")) layout.width = "normal";
  // A heading with a "View all" link runs left to right, so the section does too
  if (kids.some((k) => k.type === "heading" && (k.props as { linkLabel?: string }).linkLabel)) style.align = "left";
  const many = kids.some((k) => WIDE_BLOCKS.has(k.type) && ((k.props as { columns?: number }).columns ?? k.children.length) >= 3);
  if (many && layout.width === "narrow") layout.width = "wide";
  const words = kids.filter((k) => k.type === "text").reduce((n, k) => n + String((k.props as { text?: string }).text ?? "").length, 0);
  if (kids.every((k) => TEXT_BLOCKS.has(k.type)) && words > 600 && (layout.width === "wide" || layout.width === "full")) layout.width = "normal";
  if (kids.some((k) => k.type === "lead_form" || k.type === "booking" || k.type === "newsletter") && kids.length <= 3 && layout.width === "full") layout.width = "normal";
  const children = style.align === "center"
    ? kids.map((k) => (k.type === "text" && String((k.props as { text?: string }).text ?? "").length > 480 && !k.style.selfAlign ? { ...k, style: { ...k.style, selfAlign: "left" as const } } : k))
    : kids;
  return { ...node, style, layout, children };
}

/** One AI section as a page section; throws AiInputError (with a reason the AI can act on) when it doesn't fit the store */
export function aiSectionToNode(input: unknown, id: string, f: AiStoreFacts, schemeIds: string[]): PageNode {
  const s = aiSectionSchema.parse(input);
  const children = s.blocks.flatMap((b) => blockNodes(b, f));
  if (!children.length) throw new AiInputError("That section had nothing that can show on this store (for example reviews, when the store has none yet). Leave it out or use other blocks.");
  const node = makeNode("section", { label: s.label.slice(0, 60) }, { id, ...lookOf(s, schemeIds, f), children });
  return checked(polish(node, f));
}

export function aiHeroToNode(input: unknown, id: string, f: AiStoreFacts, schemeIds: string[]): PageNode {
  const h = aiHeroSchema.parse(input);
  const look = lookOf(h, schemeIds, f);
  const behind = look.style.background.kind === "image" ? look.style.background.src : "";
  // A picture behind the words isn't shown again beside them
  const pics = h.pictures.map((p) => pictureOf(p, f)).filter((p) => p && p !== behind);
  const covered = look.style.background.kind === "image" || look.style.background.kind === "video";
  const node = makeNode(
    "hero",
    {
      eyebrow: h.eyebrow,
      headline: h.headline || "Welcome",
      subtext: h.subtext,
      ctaLabel: h.buttonLabel,
      ctaHref: h.buttonLabel ? hrefOf(h.buttonTarget, f) || `/s/${f.slug}/products` : "",
      cta2Label: h.secondButtonLabel,
      cta2Href: h.secondButtonLabel ? hrefOf(h.secondButtonTarget, f) : "",
      image: pics[0] ?? "",
      moreImages: pics.slice(1, 3),
      layout: h.layout === "split" && !pics.length ? "left" : h.layout,
    },
    { id, style: look.style, layout: { ...look.layout, paddingY: h.space === "sm" ? "md" : look.layout.paddingY, minHeight: h.height === "auto" ? (covered ? "lg" : "md") : h.height } }
  );
  return checked(node);
}

/** The node as the page format requires it, or a reason the AI can fix */
function checked(node: PageNode): PageNode {
  const r = pageDocSchema.safeParse({ version: 1, blocks: [node] });
  if (!r.success) {
    const i = r.error.issues[0];
    throw new AiInputError(`That doesn't fit the page format: ${i.message} (at ${i.path.slice(2).join(".") || "the section"}).`);
  }
  return r.data.blocks[0];
}

/** The AI's theme as changes to the store's theme, with any unreadable scheme colours fixed */
export function aiThemeToPatch(input: unknown, current: StoreTheme): { theme: StoreTheme; announcement: string; seo: { title: string; description: string } } {
  const t = aiThemeSchema.parse(input);
  const col = (v: string, fallback: string) => normalizeHex(v) ?? fallback;
  const base = schemesOf(current);
  const schemes: ColorScheme[] = t.schemes.map((sc, i) => {
    const fix = (c: typeof sc.light, d: ColorScheme["light"]) => {
      const bg = col(c.background, d.background);
      let text = col(c.text, d.text);
      if (contrast(text, bg) < 4.5) text = contrast("#0C1F1B", bg) >= contrast("#F5F6F4", bg) ? "#0C1F1B" : "#F5F6F4";
      const button = col(c.button, d.button);
      let buttonText = col(c.buttonText, d.buttonText);
      if (contrast(buttonText, button) < 4.5) buttonText = contrast("#0C1F1B", button) >= contrast("#FFFFFF", button) ? "#0C1F1B" : "#FFFFFF";
      return { background: bg, text, button, buttonText, border: col(c.border, d.border) };
    };
    const d = base[i % base.length];
    const id = /^[\w-]{1,20}$/.test(sc.id) ? sc.id : `scheme-${i + 1}`;
    return { id, name: sc.name.slice(0, 30) || `Scheme ${i + 1}`, light: fix(sc.light, d.light), dark: fix(sc.dark, d.dark) };
  });
  const unique = schemes.filter((s, i) => schemes.findIndex((x) => x.id === s.id) === i);
  return {
    theme: {
      ...current,
      palette: t.palette as StoreTheme["palette"],
      brand: col(t.brand, current.brand ?? "#0F3D33"),
      accent: col(t.accent, current.accent ?? ""),
      fonts: t.fonts as StoreTheme["fonts"],
      corners: t.corners,
      mode: t.mode,
      schemes: unique,
    },
    announcement: t.announcement.slice(0, 80),
    seo: { title: t.seoTitle.slice(0, 70), description: t.seoDescription.slice(0, 160) },
  };
}

/** The finished page: links to sections the AI didn't end up making point at the products instead */
export function finishAiDoc(doc: PageDoc, slug: string): PageDoc {
  const ids = new Set(doc.blocks.map((b) => b.id));
  const fix = (href: unknown) => (typeof href === "string" && href.startsWith("#section-") && !ids.has(href.slice(9)) ? `/s/${slug}/products` : href);
  const walk = (n: PageNode): PageNode => {
    const p = { ...(n.props as Record<string, unknown>) };
    for (const k of ["href", "ctaHref", "cta2Href", "linkHref", "redirectHref"]) if (k in p) p[k] = fix(p[k]);
    return { ...n, props: p as PageNode["props"], children: n.children.map(walk) };
  };
  return { ...doc, blocks: doc.blocks.map(walk) };
}
