import type { Database, Json } from "../../database.types";
import { freshScope } from "../../mock/base";
import type {
  AboutContent,
  Collection,
  CoverSpec,
  CurrencyCode,
  DealRule,
  Money,
  PayoutMethod,
  Payout,
  Product,
  ProductImage,
  ProductKind,
  ProductStatus,
  Question,
  Review,
  Store,
  StoreDesign,
  StorePageKey,
  StorePages,
  TileBackground,
} from "../../types";

/**
 * Row ⇄ app-type conversions. Pure functions with no browser or server dependencies, so the
 * creator app (browser) and the storefront (server) read the database the same way.
 */

type T = Database["public"]["Tables"];
export type StoreRow = Partial<T["stores"]["Row"]> & Pick<T["stores"]["Row"], "id" | "name" | "slug" | "status" | "theme" | "theme_mode" | "currency_base" | "created_at">;
export type ProductRow = T["products"]["Row"];
export type MediaRow = T["product_media"]["Row"];
export type FileRow = T["product_files"]["Row"];

const CURRENCIES: CurrencyCode[] = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];
export const currency = (c: string | null | undefined): CurrencyCode => (CURRENCIES.includes(c as CurrencyCode) ? (c as CurrencyCode) : "INR");
export const money = (amount: number | null | undefined, cur: string | null | undefined): Money => ({ amount: Number(amount ?? 0), currency: currency(cur) });

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "PP";

/* Products ---------------------------------------------------------------- */

/** The database has no "notion" type: Notion kits are stored as templates. */
const KIND_TO_TYPE: Record<ProductKind, string> = { ebook: "ebook", template: "template", preset: "preset", notion: "template", course: "course", audio: "audio", other: "other" };
const TYPE_TO_KIND: Record<string, ProductKind> = { ebook: "ebook", template: "template", preset: "preset", course: "course", webinar: "course", audio: "audio" };

export const productType = (k: ProductKind) => KIND_TO_TYPE[k] ?? "other";
export const productKind = (t: string): ProductKind => TYPE_TO_KIND[t] ?? "other";

export const toDbStatus = (s: ProductStatus): T["products"]["Row"]["status"] => (s === "published" ? "live" : s);
export const fromDbStatus = (s: T["products"]["Row"]["status"]): ProductStatus => (s === "live" ? "published" : s);

/**
 * Generated covers (a template + colours, drawn in the browser) have no file. They're kept in
 * product_media.url as `cover:<json>` so the gallery order survives; real images are https URLs.
 */
const COVER = "cover:";
export function mediaUrl(img: ProductImage): string | null {
  if (img.src && /^https:\/\//.test(img.src)) return img.src;
  if (img.cover) return COVER + encodeURIComponent(JSON.stringify(img.cover));
  return null;
}

export function imageFrom(row: Pick<MediaRow, "id" | "url" | "alt" | "focal_x" | "focal_y">): ProductImage {
  const focal = { x: Number(row.focal_x ?? 50), y: Number(row.focal_y ?? 50) };
  if (row.url.startsWith(COVER)) {
    try {
      return { id: row.id, alt: row.alt ?? "", cover: JSON.parse(decodeURIComponent(row.url.slice(COVER.length))) as CoverSpec, focal };
    } catch {
      /* fall through to a plain image */
    }
  }
  return { id: row.id, alt: row.alt ?? "", src: row.url, focal };
}

export interface ProductStats {
  salesCount: number;
  revenue: number;
}

export function productFrom(row: ProductRow, media: MediaRow[] = [], files: FileRow[] = [], stats?: ProductStats): Product {
  const mine = media.filter((m) => m.product_id === row.id).sort((a, b) => a.sort_order - b.sort_order);
  const video = mine.find((m) => m.kind === "video");
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    kind: productKind(row.product_type),
    price: money(row.price_minor, row.currency),
    compareAt: row.compare_at_price_minor ? money(row.compare_at_price_minor, row.currency) : undefined,
    priceFloor: row.min_price_minor > 0 ? money(row.min_price_minor, row.currency) : undefined,
    images: mine.filter((m) => m.kind === "image").map(imageFrom),
    video: video ? { src: video.url, alt: video.alt ?? "", poster: video.poster_url ?? undefined, focal: { x: Number(video.focal_x), y: Number(video.focal_y) }, kind: "video" } : undefined,
    tileBackground: (row.cover_bg as TileBackground | null) ?? undefined,
    files: files
      .filter((f) => f.product_id === row.id)
      .map((f) => ({ id: f.id, name: f.file_name, size: Number(f.size_bytes), mime: f.mime_type ?? "application/octet-stream", path: f.storage_path })),
    sku: row.sku ?? "",
    taxCode: row.hsn_sac ?? "",
    status: fromDbStatus(row.status),
    sourceUrl: row.source_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    salesCount: stats?.salesCount ?? 0,
    revenue: money(stats?.revenue ?? 0, row.currency),
  };
}

/* Stores ------------------------------------------------------------------ */

export const DEFAULT_BRAND = "#0F3D33";

export function storeFrom(row: StoreRow, owner: { name: string; email: string }, refundPolicy = ""): Store {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline ?? "",
    ownerName: owner.name,
    ownerEmail: owner.email,
    brandColor: row.brand_color ?? DEFAULT_BRAND,
    logoText: initials(row.name),
    currency: currency(row.currency_base),
    supportEmail: row.support_email ?? owner.email,
    refundPolicy,
    refundDays: row.refund_days ?? 7,
    createdAt: row.created_at,
    onboarded: row.status === "published",
    logo: row.logo_url ? { src: row.logo_url, alt: `${row.name} logo` } : undefined,
  };
}

/** The look a store starts with until the creator changes it (the same defaults as the demo). */
export function defaultDesign(store: Store): StoreDesign {
  return freshScope(Date.parse(store.createdAt) || Date.now(), store).design;
}

/** stores.theme holds the whole design; theme_mode mirrors its light/dark default for the server. */
export function designFrom(store: Store, theme: Json, mode: string, about?: AboutContent): StoreDesign {
  const saved = (theme && typeof theme === "object" && !Array.isArray(theme) ? theme : {}) as Partial<StoreDesign>;
  const base = defaultDesign(store);
  const design: StoreDesign = { ...base, ...saved, theme: { ...base.theme, ...saved.theme, mode: (mode as StoreDesign["theme"]["mode"]) ?? "auto" } };
  if (about) design.about = about;
  return design;
}

/** The design without the About content, which lives in store_pages. */
export function designToTheme(d: StoreDesign): Json {
  const { about: _about, ...rest } = d;
  void _about;
  return JSON.parse(JSON.stringify(rest)) as Json;
}

/* About, FAQ and policies -------------------------------------------------- */

type PageRow = Pick<T["store_pages"]["Row"], "kind" | "content" | "edited">;

/**
 * Pages nobody has edited show the app's default text (which names the store and its support
 * email); once edited, the saved text wins. FAQ rows hold `{ items, contactNote }`, About holds
 * the About fields, policies hold `{ text }`.
 */
export function pagesFrom(store: Store, rows: PageRow[], design?: StoreDesign): { pages: StorePages; about: AboutContent } {
  const defaults = freshScope(Date.now(), store);
  const by = new Map(rows.map((r) => [r.kind, r]));
  const content = (k: StorePageKey) => (by.get(k)?.content ?? {}) as Record<string, unknown>;
  const edited = (k: StorePageKey) => Boolean(by.get(k)?.edited);
  const text = (k: "refund" | "terms" | "privacy") => (edited(k) && typeof content(k).text === "string" ? (content(k).text as string) : defaults.storePages[k]);
  const faq = content("faq");
  const pages: StorePages = {
    faq: edited("faq") && Array.isArray(faq.items) ? (faq.items as StorePages["faq"]) : defaults.storePages.faq,
    refund: text("refund"),
    terms: text("terms"),
    privacy: text("privacy"),
    contactNote: typeof faq.contactNote === "string" ? faq.contactNote : defaults.storePages.contactNote,
    edited: Object.fromEntries((["about", "faq", "refund", "terms", "privacy"] as StorePageKey[]).map((k) => [k, edited(k)])),
  };
  const aboutRow = content("about");
  const about = edited("about") && typeof aboutRow.story === "string" ? (aboutRow as unknown as AboutContent) : (design?.about ?? defaults.design.about);
  return { pages, about };
}

/* Collections ------------------------------------------------------------- */

/** collections.bg holds the tile look: `{ background?, cover, description }`. */
export function collectionFrom(row: T["collections"]["Row"], items: T["collection_items"]["Row"][]): Collection {
  const bg = (row.bg ?? {}) as { background?: TileBackground; cover?: CoverSpec; description?: string };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: bg.description ?? "",
    productIds: items.filter((i) => i.collection_id === row.id).sort((a, b) => a.sort_order - b.sort_order).map((i) => i.product_id),
    cover: bg.cover ?? { template: "block", title: row.name, bg: DEFAULT_BRAND, fg: "#F5F6F4", accent: "#C9A24F" },
    background: bg.background,
  };
}

/* Deal paths -------------------------------------------------------------- */

/**
 * The database knows two rewards: percent off when every trigger product is in the cart
 * (a bundle discount), and a free product for the same condition (a free gift).
 */
export function dealRuleFrom(row: T["deal_rules"]["Row"]): DealRule {
  const common = {
    id: row.id,
    name: row.name,
    active: row.active,
    stackable: false,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    createdAt: row.created_at,
    stats: { views: 0, uses: 0, revenueLift: money(0, "INR") },
  };
  if (row.reward === "free_product") return { ...common, kind: "free_gift", triggerIds: row.trigger_product_ids, giftId: row.reward_product_id! };
  return { ...common, kind: "bundle_discount", productIds: row.trigger_product_ids, percent: Math.round((row.percent_bps ?? 0) / 100) };
}

/* Reviews and questions --------------------------------------------------- */

type ReviewRow = Omit<T["reviews"]["Row"], "order_id"> & { order_id?: string };

export function reviewFrom(row: ReviewRow, pinned = false): Review {
  return {
    id: row.id,
    productId: row.product_id,
    rating: Math.min(5, Math.max(1, row.rating)) as Review["rating"],
    title: row.title ?? "",
    body: row.body ?? "",
    photos: row.photos.map((src, i) => ({ id: `${row.id}-p${i}`, alt: `Photo from ${row.reviewer_name}`, src })),
    author: row.reviewer_name,
    createdAt: row.created_at,
    helpful: 0,
    verified: true,
    imported: false,
    reply: row.creator_reply ? { body: row.creator_reply, createdAt: row.replied_at ?? row.updated_at } : undefined,
    pinned,
    hidden: row.status === "hidden",
    reported: false,
  };
}

type QuestionRow = Omit<T["questions"]["Row"], "asker_email" | "updated_at">;

export function questionFrom(row: QuestionRow, creatorName: string): Question {
  return {
    id: row.id,
    productId: row.product_id,
    asker: row.asker_name,
    // Never selected: asker emails stay on the server
    askerEmail: "",
    body: row.body,
    createdAt: row.created_at,
    answers: row.answer ? [{ id: `${row.id}-a`, author: creatorName, role: "creator", body: row.answer, createdAt: row.answered_at ?? row.created_at }] : [],
    hidden: row.status === "hidden",
    reported: false,
  };
}

/* Payouts ------------------------------------------------------------------ */

export function payoutMethodFrom(row: Omit<T["payout_methods"]["Row"], "gateway_fund_account_id"> & { gateway_fund_account_id?: string | null }): PayoutMethod {
  const upi = row.kind === "upi";
  return {
    id: row.id,
    kind: "bank",
    label: upi ? "UPI" : row.bank_name ?? "Bank account",
    last4: upi ? row.upi_masked ?? "" : row.account_last4 ?? "",
    holderName: row.holder_name,
    ifsc: row.ifsc ?? undefined,
    bankName: row.bank_name ?? undefined,
    verified: Boolean(row.verified_at),
    primary: row.is_default,
  };
}

export function payoutFrom(row: T["payouts"]["Row"], methods: PayoutMethod[]): Payout {
  const m = methods.find((x) => x.id === row.method_id);
  const status: Payout["status"] = row.status === "paid" ? "paid" : row.status === "failed" || row.status === "cancelled" ? "failed" : "processing";
  return {
    id: row.id,
    amount: money(row.amount_minor, row.currency),
    status,
    methodId: row.method_id,
    methodLabel: m ? `${m.label} ····${m.last4.slice(-4)}` : "Payout method",
    reference: row.gateway_payout_id ?? undefined,
    createdAt: row.requested_at,
    arrivedAt: row.status === "paid" ? row.processed_at ?? undefined : undefined,
    failureReason: row.failure_reason ?? undefined,
  };
}
