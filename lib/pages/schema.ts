import { z } from "zod";
import type { Store, StoreDesign } from "../types";

/**
 * Store page documents (Part 4C): a JSON tree of blocks, validated with zod.
 *
 * - The page root holds sections (and heroes). Sections hold content blocks or a columns block.
 *   Columns hold 2–4 column blocks; columns hold content blocks. See `CHILDREN`.
 * - Every node carries its own style, layout and visibility. Nothing is positioned freely: spacing,
 *   widths and type sizes come from fixed scales so every page stays on-brand at every size.
 * - There is no HTML or script anywhere. Text is plain text; links must be site paths or https.
 * - The tree is ready for drag and drop: moving is `moveNode(id, parentId, index)` in the editor
 *   store; the UI uses up/down buttons for now.
 */

/* ------------------------------------------------------------------ */
/* Shared value types                                                   */
/* ------------------------------------------------------------------ */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #0F3D33.");

/** Site-relative path, https URL, mailto, or #anchor. Never javascript: or data:. */
export const safeHref = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^(\/(?!\/)|#|https:\/\/|mailto:)/i.test(v), "Use a link starting with /, # or https://.");

/**
 * Media sources: "asset:<id>" (uploaded, kept in this browser), "product:<id>" (a product's cover),
 * or an https URL.
 */
export const mediaSrc = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || /^(asset:[\w-]+|product:[\w-]+|https:\/\/)/.test(v), "Upload a file, pick a product cover, or use an https:// link.");

const focal = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) });

export const backgroundSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("solid"), color: hex }),
  z.object({ kind: z.literal("gradient"), from: hex, to: hex, angle: z.number().int().min(0).max(360) }),
  z.object({ kind: z.literal("image"), src: mediaSrc, alt: z.string().max(200).default(""), focal }),
  z.object({ kind: z.literal("gif"), src: mediaSrc, alt: z.string().max(200).default(""), focal }),
  z.object({ kind: z.literal("video"), src: mediaSrc, poster: mediaSrc, focal }),
]);
export type Background = z.infer<typeof backgroundSchema>;

export const styleSchema = z.object({
  background: backgroundSchema.default({ kind: "none" }),
  /** Overlay over image/GIF/video backgrounds, 0–80% */
  overlay: z.number().min(0).max(0.8).default(0),
  overlayColor: hex.default("#000000"),
  /** Text colour over the background; auto picks for contrast */
  tone: z.enum(["auto", "light", "dark"]).default("auto"),
  align: z.enum(["left", "center", "right"]).default("left"),
  /** From the token scale only */
  radius: z.enum(["none", "sm", "md", "lg"]).default("none"),
  border: z.boolean().default(false),
  shadow: z.enum(["none", "soft"]).default("none"),
  /** Content blocks: their own alignment. Empty follows the section or column around them. */
  selfAlign: z.enum(["", "left", "center", "right"]).default(""),
  /** A colour scheme from the theme (its id). Empty follows the section around it, or the page. */
  scheme: z.string().max(40).default(""),
});
export type BlockStyle = z.infer<typeof styleSchema>;

export const layoutSchema = z.object({
  paddingY: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
  width: z.enum(["narrow", "normal", "wide", "full"]).default("normal"),
  minHeight: z.enum(["auto", "sm", "md", "lg", "screen"]).default("auto"),
  gap: z.enum(["sm", "md", "lg"]).default("md"),
  /** Sections: the background and colour scheme cover the whole width, or only a panel behind the content */
  fill: z.enum(["full", "content"]).default("full"),
});
export type BlockLayout = z.infer<typeof layoutSchema>;

export const visibilitySchema = z.object({ mobile: z.boolean().default(true), desktop: z.boolean().default(true) });

/* ------------------------------------------------------------------ */
/* Block props                                                          */
/* ------------------------------------------------------------------ */

/** An icon from the library (components/pp/icon-library.tsx), by name. Older pages used short lowercase names. */
const iconName = z.string().regex(/^[A-Za-z]{1,40}$/, "Pick an icon from the list.");
export const ICON_WEIGHTS = ["thin", "light", "regular", "bold", "fill", "duotone"] as const;

const text = (max: number) => z.string().max(max, `Keep it under ${max} characters.`);

export const LEAD_FIELD_TYPES = ["text", "email", "phone", "textarea"] as const;

/** Time zones a calendar can run in (the visitor sees times in the calendar's zone) */
export const BOOKING_ZONES = [
  { id: "Asia/Kolkata", label: "India (IST)" },
  { id: "Asia/Dubai", label: "Dubai (GST)" },
  { id: "Asia/Singapore", label: "Singapore (SGT)" },
  { id: "Australia/Sydney", label: "Sydney (AEST)" },
  { id: "Europe/London", label: "London (GMT/BST)" },
  { id: "Europe/Berlin", label: "Central Europe (CET)" },
  { id: "America/New_York", label: "New York (ET)" },
  { id: "America/Chicago", label: "Chicago (CT)" },
  { id: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { id: "UTC", label: "UTC" },
] as const;

export const PROPS = {
  section: z.object({ label: text(60).default("") }),
  columns: z.object({ stackOnMobile: z.boolean().default(true), ratio: z.enum(["equal", "2:1", "1:2"]).default("equal"), valign: z.enum(["start", "center", "end"]).default("start") }),
  column: z.object({}),
  hero: z.object({
    eyebrow: text(60).default(""),
    headline: text(120).min(1, "Add a headline."),
    subtext: text(300).default(""),
    ctaLabel: text(40).default(""),
    ctaHref: safeHref.default(""),
    image: mediaSrc.default(""),
    imageAlt: text(200).default(""),
    layout: z.enum(["left", "centered", "split"]).default("left"),
    /** Up to two more pictures beside the first, as a collage */
    moreImages: z.array(mediaSrc).max(2).default([]),
    cta2Label: text(40).default(""),
    cta2Href: safeHref.default(""),
  }),
  heading: z.object({
    text: text(160).min(1, "Add some text."),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    size: z.enum(["sm", "md", "lg", "xl"]).default("lg"),
    /** An optional link on the right, like "View all" */
    linkLabel: text(40).default(""),
    linkHref: safeHref.default(""),
  }),
  /** Rich text, kept safe: **bold**, _italic_ and [links](https://…) only. No HTML. */
  text: z.object({ text: text(4000).default(""), size: z.enum(["sm", "md", "lg"]).default("md") }),
  button: z.object({
    label: text(40).min(1, "Add a label."),
    action: z.enum(["link", "product"]).default("link"),
    href: safeHref.default(""),
    /** For action "product": scrolls to that product's card on this page, or opens its page */
    productId: z.string().default(""),
    variant: z.enum(["primary", "secondary", "brass"]).default("primary"),
    size: z.enum(["sm", "md", "lg"]).default("md"),
  }),
  image: z.object({ src: mediaSrc.default(""), alt: text(200).default(""), aspect: z.enum(["auto", "1:1", "4:3", "16:9", "3:4"]).default("4:3"), fit: z.enum(["cover", "contain"]).default("cover"), focal: focal.default({ x: 50, y: 50 }), caption: text(200).default(""), href: safeHref.default("") }),
  gallery: z.object({ images: z.array(z.object({ src: mediaSrc, alt: text(200).default("") })).max(12, "Up to 12 images.").default([]), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3) }),
  /** An uploaded video, or a YouTube or Vimeo link (played in their privacy-friendly players) */
  video: z.object({ src: mediaSrc.default(""), poster: mediaSrc.default(""), caption: text(200).default(""), autoplay: z.boolean().default(false), aspect: z.enum(["16:9", "4:3", "1:1", "9:16"]).default("16:9") }),
  table: z.object({
    rows: z.array(z.array(text(200)).min(1).max(8, "Up to 8 columns.")).min(1).max(30, "Up to 30 rows.").default([["Column 1", "Column 2"], ["", ""]]),
    header: z.boolean().default(true),
    striped: z.boolean().default(false),
  }),
  divider: z.object({}),
  spacer: z.object({ size: z.enum(["sm", "md", "lg", "xl"]).default("md") }),
  product_card: z.object({ productId: z.string().default(""), showBuy: z.boolean().default(true) }),
  product_grid: z.object({ source: z.enum(["all", "collection", "manual"]).default("all"), sort: z.enum(["featured", "popular", "newest", "price-asc", "price-desc"]).default("featured"), collectionSlug: z.string().default(""), productIds: z.array(z.string()).default([]), limit: z.number().int().min(1).max(24).default(6), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3) }),
  /** "auto" shows instant download, secure payment, the refund window and your rating */
  highlights: z.object({
    source: z.enum(["auto", "manual"]).default("manual"),
    items: z.array(z.object({ icon: iconName.default("Check"), title: text(60), body: text(160).default("") })).max(6, "Up to 6 items.").default([]),
    /** Icons for the automatic points, in order: download, payment, refunds, rating */
    autoIcons: z.array(iconName).max(4).default(["DownloadSimple", "ShieldCheck", "ArrowCounterClockwise", "Star"]),
    iconWeight: z.enum(ICON_WEIGHTS).default("regular"),
    look: z.enum(["strip", "cards"]).default("strip"),
  }),
  testimonials: z.object({ source: z.enum(["reviews", "manual"]).default("reviews"), items: z.array(z.object({ quote: text(400), author: text(60) })).max(6).default([]), limit: z.number().int().min(1).max(6).default(3) }),
  /** "store" shows the questions from Store › Pages › FAQ */
  faq: z.object({ source: z.enum(["manual", "store"]).default("manual"), limit: z.number().int().min(1).max(20).default(5), items: z.array(z.object({ q: text(200), a: text(1000) })).max(20).default([]) }),
  /** Cards side by side, each its own block (image, title, text, button) */
  cards: z.object({ columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3), look: z.enum(["card", "plain"]).default("card"), aspect: z.enum(["none", "1:1", "4:3", "16:9", "3:4"]).default("4:3") }),
  card: z.object({ icon: z.union([iconName, z.literal("")]).default(""), iconWeight: z.enum(ICON_WEIGHTS).default("duotone"), image: mediaSrc.default(""), imageAlt: text(200).default(""), title: text(120).default(""), text: text(600).default(""), ctaLabel: text(40).default(""), ctaHref: safeHref.default("") }),
  /** The store's collections as tiles */
  collection_list: z.object({ limit: z.number().int().min(1).max(12).default(6), columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(6)]).default(6) }),
  /** The store's live bundles */
  offers: z.object({}),
  /** The creator's photo, story and a link to the About page (edited in Store › Pages › About) */
  about: z.object({ showLink: z.boolean().default(true) }),
  /** A moving line of words or logos */
  marquee: z.object({
    mode: z.enum(["text", "logos"]).default("text"),
    items: z.array(z.object({ text: text(80).default(""), src: mediaSrc.default(""), alt: text(200).default(""), href: safeHref.default("") })).max(12, "Up to 12 items.").default([]),
    speed: z.enum(["slow", "normal", "fast"]).default("normal"),
    direction: z.enum(["left", "right"]).default("left"),
    pauseOnHover: z.boolean().default(true),
  }),
  /** An uploaded HTML file, shown in a sandboxed frame */
  custom_html: z.object({ name: text(120).default(""), source: z.string().max(300 * 1024, "HTML files can be up to 300 KB.").default(""), height: z.number().int().min(80).max(4000).optional() }),
  countdown: z.object({ endsAt: z.string().default(""), label: text(80).default("Offer ends in") }),
  newsletter: z.object({ heading: text(100).default("Get new releases first"), body: text(240).default("") }),
  /** Collects name, email and answers. Submissions land in Sales › Leads. */
  lead_form: z
    .object({
      heading: text(100).default("Get the free guide"),
      body: text(240).default(""),
      fields: z
        .array(z.object({ id: z.string().min(1).max(24), label: text(60).min(1, "Name the field."), type: z.enum(LEAD_FIELD_TYPES), required: z.boolean().default(true) }))
        .min(1, "Add at least one field.")
        .max(6, "Up to 6 fields keeps it short.")
        .default([
          { id: "name", label: "Your name", type: "text", required: true },
          { id: "email", label: "Email", type: "email", required: true },
        ]),
      buttonLabel: text(40).min(1, "Add a button label.").default("Send it to me"),
      successMessage: text(240).default("Thanks! Check your inbox soon."),
      /** Where to send people after they submit; blank keeps them on the page with the message */
      redirectHref: safeHref.default(""),
    })
    .refine((v) => v.fields.some((f) => f.type === "email"), { path: ["fields"], message: "Add an email field so you can reach people." }),
  /** An instant calendar: visitors pick a day and a free time. Bookings land in Sales › Leads. */
  booking: z
    .object({
      heading: text(100).default("Book a time"),
      body: text(240).default("Pick a day, then a time that suits you."),
      durationMin: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).default(30),
      /** 0 = Sunday … 6 = Saturday */
      days: z.array(z.number().int().min(0).max(6)).max(7).default([1, 2, 3, 4, 5]),
      startHour: z.number().int().min(0).max(23).default(10),
      endHour: z.number().int().min(1).max(24).default(17),
      daysAhead: z.number().int().min(1).max(60).default(14),
      timezone: z.enum(BOOKING_ZONES.map((z) => z.id) as [string, ...string[]]).default("Asia/Kolkata"),
      buttonLabel: text(40).min(1).default("Book this time"),
      successMessage: text(240).default("You're booked. We'll email you to confirm."),
    })
    .refine((v) => v.endHour > v.startHour, { path: ["endHour"], message: "The day should end after it starts." })
    .refine((v) => v.days.length > 0, { path: ["days"], message: "Pick at least one day." }),
} as const;

export type BlockType = keyof typeof PROPS;
export const BLOCK_TYPES = Object.keys(PROPS) as BlockType[];
export type BlockProps<T extends BlockType> = z.infer<(typeof PROPS)[T]>;

/** Which children each type may hold. Content blocks hold nothing. */
export const CONTENT_TYPES: BlockType[] = ["heading", "text", "button", "image", "gallery", "video", "table", "divider", "spacer", "cards", "product_card", "product_grid", "collection_list", "offers", "highlights", "testimonials", "about", "marquee", "faq", "countdown", "newsletter", "lead_form", "booking", "custom_html"];
export const CHILDREN = {
  ...(Object.fromEntries(CONTENT_TYPES.map((t) => [t, []])) as unknown as Record<BlockType, BlockType[]>),
  root: ["section", "hero"],
  section: ["columns", ...CONTENT_TYPES],
  columns: ["column"],
  column: CONTENT_TYPES.filter((t) => t !== "cards"),
  cards: ["card"],
  card: [],
  hero: [],
} as Record<BlockType | "root", BlockType[]>;

export interface PageNode<T extends BlockType = BlockType> {
  id: string;
  type: T;
  props: BlockProps<T>;
  style: BlockStyle;
  layout: BlockLayout;
  visibility: { mobile: boolean; desktop: boolean };
  children: PageNode[];
}

const nodeSchema: z.ZodType<PageNode> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      type: z.enum(BLOCK_TYPES as [BlockType, ...BlockType[]]),
      props: z.record(z.unknown()),
      style: styleSchema,
      layout: layoutSchema,
      visibility: visibilitySchema,
      children: z.array(nodeSchema),
    })
    .superRefine((n, ctx) => {
      const r = PROPS[n.type].safeParse(n.props);
      if (!r.success) for (const i of r.error.issues) ctx.addIssue({ ...i, path: ["props", ...i.path] });
      const allowed = CHILDREN[n.type];
      n.children.forEach((c, i) => {
        if (!allowed.includes(c.type)) ctx.addIssue({ code: "custom", path: ["children", i], message: `A ${n.type} block can't hold a ${c.type} block.` });
      });
      if (n.type === "columns" && (n.children.length < 2 || n.children.length > 4)) ctx.addIssue({ code: "custom", path: ["children"], message: "Columns need 2 to 4 columns." });
      if (n.type === "cards" && (n.children.length < 1 || n.children.length > 12)) ctx.addIssue({ code: "custom", path: ["children"], message: "Cards need 1 to 12 cards." });
    }) as unknown as z.ZodType<PageNode>
);

export const pageDocSchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(nodeSchema).max(40, "Up to 40 sections on a page."),
    /** Behind every section (Part 6B). Sections with their own background sit on top. */
    style: styleSchema.optional(),
    /** Focus mode (squeeze pages): the store's menu and footer are hidden so there is one thing to do */
    focus: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    d.blocks.forEach((b, i) => {
      if (!CHILDREN.root.includes(b.type)) ctx.addIssue({ code: "custom", path: ["blocks", i], message: `Put the ${b.type} block inside a section.` });
    });
    const ids = new Set<string>();
    const walk = (n: PageNode) => {
      if (ids.has(n.id)) ctx.addIssue({ code: "custom", path: ["blocks"], message: `Duplicate block id ${n.id}.` });
      ids.add(n.id);
      n.children.forEach(walk);
    };
    d.blocks.forEach(walk);
  });

export type PageDoc = z.infer<typeof pageDocSchema>;

export const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PageVersion {
  id: string;
  at: string;
  label: string;
  doc: PageDoc;
}

/** A visual store page: a working draft, what's published, and history. */
export interface StorePageDoc {
  id: string;
  title: string;
  slug: string;
  template: string;
  draft: PageDoc;
  published?: PageDoc;
  publishedAt?: string;
  updatedAt: string;
  seo: { title: string; description: string };
  /** Newest first, at most 20 */
  versions: PageVersion[];
  /** Home page only: store-wide settings changed in the editor, not yet published */
  site?: { design: StoreDesign; logo?: Store["logo"] };
}

/* ------------------------------------------------------------------ */
/* Constructors                                                         */
/* ------------------------------------------------------------------ */

let counter = 0;
export function nodeId(prefix = "b"): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** A node of `type` with every default filled in, plus any overrides. */
export interface NodeOverrides {
  id?: string;
  style?: Partial<z.input<typeof styleSchema>>;
  layout?: Partial<z.input<typeof layoutSchema>>;
  visibility?: Partial<z.input<typeof visibilitySchema>>;
  children?: PageNode[];
}

export function makeNode<T extends BlockType>(type: T, props: Partial<z.input<(typeof PROPS)[T]>> = {}, rest: NodeOverrides = {}): PageNode<T> {
  const defaults: Record<string, unknown> = { heading: { text: "Heading" }, button: { label: "Shop now", href: "" }, hero: { headline: "A headline that says what you sell" } };
  const parsedProps = PROPS[type].parse({ ...(defaults[type] as object), ...props }) as BlockProps<T>;
  const children =
    rest.children ??
    (type === "columns"
      ? [makeNode("column", {}, { children: [makeNode("text", { text: "Left column" })] }), makeNode("column", {}, { children: [makeNode("text", { text: "Right column" })] })]
      : type === "cards"
        ? [1, 2, 3].map((i) => makeNode("card", { title: `Card ${i}`, text: "A line or two about this." }))
        : []);
  return {
    id: rest.id ?? nodeId(),
    type,
    props: parsedProps,
    style: styleSchema.parse(rest.style ?? {}),
    layout: layoutSchema.parse(rest.layout ?? {}),
    visibility: visibilitySchema.parse(rest.visibility ?? {}),
    children,
  };
}

export function emptyDoc(): PageDoc {
  return { version: 1, blocks: [] };
}

/** Deep copy with fresh ids, for duplicate and templates. */
export function cloneNode(n: PageNode): PageNode {
  return { ...structuredCloneSafe(n), id: nodeId(), children: n.children.map(cloneNode) };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/* ------------------------------------------------------------------ */
/* Tree helpers (pure)                                                  */
/* ------------------------------------------------------------------ */

export function findNode(blocks: PageNode[], id: string): PageNode | undefined {
  for (const b of blocks) {
    if (b.id === id) return b;
    const hit = findNode(b.children, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Parent id ("root" for top level) and index of a node. */
export function locate(blocks: PageNode[], id: string, parent: string = "root"): { parentId: string; index: number } | undefined {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === id) return { parentId: parent, index: i };
    const hit = locate(blocks[i].children, id, blocks[i].id);
    if (hit) return hit;
  }
  return undefined;
}

export function childrenOf(blocks: PageNode[], parentId: string): PageNode[] | undefined {
  return parentId === "root" ? blocks : findNode(blocks, parentId)?.children;
}

export function parentType(blocks: PageNode[], parentId: string): BlockType | "root" | undefined {
  return parentId === "root" ? "root" : findNode(blocks, parentId)?.type;
}

/** The top-level section (or hero) that contains a node. */
export function sectionOf(blocks: PageNode[], id: string): PageNode | undefined {
  return blocks.find((b) => b.id === id || !!findNode(b.children, id));
}

export function countNodes(blocks: PageNode[]): number {
  return blocks.reduce((t, b) => t + 1 + countNodes(b.children), 0);
}
