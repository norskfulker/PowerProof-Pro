/**
 * Products from a link: what a page or shop publishes (Shopify and WooCommerce product data,
 * schema.org product data, or the page's own layout) turned into one shape the creator previews
 * and adds. Pure: no network, no storage. Prices are minor units in the source's currency.
 */

/** Where products came from: a page or shop on the web */
export type ImportSource = "website";

export interface ImportedVariant {
  key: string;
  title: string;
  options: string[];
  sku: string;
  price: number;
  compareAt?: number;
  stock?: number;
}

export interface ImportedProduct {
  /** The source's own id, so a second import can skip what's already here */
  key: string;
  title: string;
  /** Plain text */
  description: string;
  fulfilment: "digital" | "physical";
  price: number;
  compareAt?: number;
  currency: string;
  sku: string;
  images: { src: string; alt: string }[];
  /** A plain video file (MP4 or WebM), when the source has one */
  video?: { src: string; poster?: string };
  options: { name: string; values: string[] }[];
  variants: ImportedVariant[];
  trackStock: boolean;
  stock?: number;
  weightGrams?: number;
  /** Collection (category) names */
  collections: string[];
  sourceUrl?: string;
  live: boolean;
  /** Things to fix before it can go live here, in plain words */
  problems: string[];
}

export interface ImportPreview {
  source: ImportSource;
  /** The shop's domain or the site's address */
  label: string;
  store: { name?: string; logo?: string; color?: string; currency?: string };
  products: ImportedProduct[];
  warnings: string[];
}

/* Helpers ------------------------------------------------------------------------------- */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", hellip: "…", mdash: "—", ndash: "–", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };

/** HTML (product descriptions) as plain paragraphs: block tags become breaks, everything else goes */
export function htmlToText(html: string | null | undefined, max = 5000): string {
  if (!html) return "";
  const text = html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\s*\/\s*li\s*>/gi, "")
    .replace(/<\s*\/\s*(p|div|h[1-6]|ul|ol|tr|section|article)\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.slice(0, max);
}

/** Currencies with no minor unit */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XAF", "XOF"]);

/** "1,299.50" or 1299.5 → minor units */
export function toMinor(v: string | number | null | undefined, currency = "INR"): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100));
}

/** Minor units → the price as shown (49900 → 499) */
export const toMajor = (minor: number, currency = "INR") => (ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100);

const https = (u: unknown): string | undefined => {
  if (typeof u !== "string") return undefined;
  const s = u.trim().startsWith("//") ? `https:${u.trim()}` : u.trim();
  return /^https:\/\/[^\s]+$/i.test(s) && s.length <= 2048 ? s : undefined;
};

const uniqImages = (list: { src?: string; alt?: string }[]) => {
  const seen = new Set<string>();
  return list
    .map((i) => ({ src: https(i.src) ?? "", alt: (i.alt ?? "").slice(0, 200) }))
    .filter((i) => i.src && !seen.has(i.src) && seen.add(i.src))
    .slice(0, 8);
};

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Options from variants' chosen values, when a source lists the values per variant only */
function optionsFrom(names: string[], variants: { options: string[] }[]) {
  return names
    .map((name, i) => ({ name: clean(name, 40), values: [...new Set(variants.map((v) => v.options[i]).filter(Boolean))].slice(0, 50) }))
    .filter((o) => o.name && o.values.length)
    .slice(0, 3);
}

/** What a product still needs before it can go live here */
function problemsOf(p: Omit<ImportedProduct, "problems">, hadFiles = false): string[] {
  const out: string[] = [];
  if (p.fulfilment === "digital") out.push(hadFiles ? "Upload its file again: downloads can't be copied across." : "Add the file buyers download.");
  if (!p.images.length) out.push("Add a picture.");
  if (p.price <= 0 && !p.variants.some((v) => v.price > 0)) out.push("Set a price.");
  if (p.variants.length > 100) out.push("Only the first 100 variants come across.");
  return out;
}

function product(p: Omit<ImportedProduct, "problems">, hadFiles = false): ImportedProduct {
  const variants = p.variants.slice(0, 100);
  const price = p.price || variants.find((v) => v.price > 0)?.price || 0;
  const base = { ...p, title: clean(p.title, 160) || "Untitled product", price, variants, options: variants.length ? p.options : [] };
  return { ...base, problems: problemsOf(p, hadFiles) };
}

/* Shopify's public product data ---------------------------------------------------------- */

/** A Shopify product's own page data (/products/handle.js): its media, videos included */
export interface ShopifyProductJs {
  media?: { media_type?: string; preview_image?: { src?: string }; sources?: { format?: string; mime_type?: string; url?: string; height?: number }[] }[];
}

/** The product's video as one MP4 file, at most 720p (smaller to copy) */
export function shopifyVideo(js: ShopifyProductJs | undefined): ImportedProduct["video"] {
  const v = js?.media?.find((m) => m.media_type === "video");
  const mp4 = (v?.sources ?? []).filter((x) => x.url && (x.format === "mp4" || x.mime_type === "video/mp4")).sort((a, b) => Math.abs((a.height ?? 720) - 720) - Math.abs((b.height ?? 720) - 720))[0];
  const src = https(mp4?.url);
  if (!src) return undefined;
  const poster = https(v?.preview_image?.src);
  return { src, poster };
}

export interface ShopifyPublicProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  product_type?: string;
  options?: { name: string; values?: string[] }[];
  images?: { src: string; alt?: string | null }[];
  variants?: { id: number; title: string; price: string; compare_at_price?: string | null; sku?: string | null; requires_shipping?: boolean; option1?: string | null; option2?: string | null; option3?: string | null; grams?: number; /** What the prices are in, when the shop says */ price_currency?: string }[];
}

export function fromShopifyPublic(list: ShopifyPublicProduct[], shopCurrency: string, origin: string): ImportedProduct[] {
  return list.map((n) => {
    const vs = n.variants ?? [];
    // Shopify can answer in a visitor's local currency, and says so on each variant
    const said = vs[0]?.price_currency?.toUpperCase();
    const currency = said && /^[A-Z]{3}$/.test(said) ? said : shopCurrency;
    const names = (n.options ?? []).map((o) => o.name);
    const real = !(names.length === 1 && names[0] === "Title" && vs.length <= 1);
    const variants: ImportedVariant[] = real
      ? vs.map((v) => ({ key: String(v.id), title: clean(v.title, 120), options: [v.option1, v.option2, v.option3].slice(0, names.length).map((x) => clean(x, 60)), sku: clean(v.sku, 32), price: toMinor(v.price, currency), compareAt: v.compare_at_price ? toMinor(v.compare_at_price, currency) : undefined }))
      : [];
    const first = vs[0];
    return product({
      key: String(n.id),
      title: n.title,
      description: htmlToText(n.body_html),
      fulfilment: vs.some((v) => v.requires_shipping !== false) ? "physical" : "digital",
      price: toMinor(first?.price, currency),
      compareAt: first?.compare_at_price ? toMinor(first.compare_at_price, currency) : undefined,
      currency,
      sku: real ? "" : clean(first?.sku, 32),
      images: uniqImages((n.images ?? []).map((i) => ({ src: i.src, alt: i.alt ?? "" }))),
      options: real ? optionsFrom(names, variants) : [],
      variants,
      trackStock: false,
      weightGrams: first?.grams || undefined,
      collections: n.product_type ? [clean(n.product_type, 80)] : [],
      sourceUrl: `${origin}/products/${n.handle}`,
      live: true,
    });
  });
}

/* WooCommerce's public Store API -------------------------------------------------------------- */

export interface WooStoreProduct {
  id: number;
  name: string;
  permalink?: string;
  description?: string;
  short_description?: string;
  sku?: string;
  prices?: { price?: string; regular_price?: string; sale_price?: string; currency_code?: string; currency_minor_unit?: number };
  images?: { src: string; alt?: string }[];
  categories?: { name: string }[];
  attributes?: { name: string; has_variations?: boolean; terms?: { name: string }[] }[];
  variations?: { id: number; attributes?: { name: string; value: string }[] }[];
  is_virtual?: boolean;
  is_downloadable?: boolean;
}

export function fromWooStore(list: WooStoreProduct[], fallbackCurrency: string): ImportedProduct[] {
  return list.map((p) => {
    const currency = p.prices?.currency_code || fallbackCurrency;
    const unit = 10 ** (p.prices?.currency_minor_unit ?? 2);
    // Store API prices are already in minor units of the store's currency
    const minor = (v?: string) => (v ? Math.round((Number(v) / unit) * (ZERO_DECIMAL.has(currency) ? 1 : 100)) : 0);
    const price = minor(p.prices?.sale_price || p.prices?.price);
    const regular = minor(p.prices?.regular_price);
    const attrs = (p.attributes ?? []).filter((a) => a.has_variations);
    const variants: ImportedVariant[] = (p.variations ?? []).map((v) => {
      const opts = attrs.map((a) => clean(v.attributes?.find((x) => x.name.toLowerCase() === a.name.toLowerCase())?.value, 60));
      return { key: String(v.id), title: opts.filter(Boolean).join(" / ") || `Option ${v.id}`, options: opts, sku: "", price, compareAt: regular > price ? regular : undefined };
    });
    return product({
      key: String(p.id),
      title: htmlToText(p.name, 160),
      description: htmlToText(p.description || p.short_description),
      fulfilment: p.is_virtual || p.is_downloadable ? "digital" : "physical",
      price,
      compareAt: regular > price ? regular : undefined,
      currency,
      sku: variants.length ? "" : clean(p.sku, 32),
      images: uniqImages(p.images ?? []),
      options: variants.length ? attrs.map((a) => ({ name: clean(a.name, 40), values: (a.terms ?? []).map((t) => clean(t.name, 60)).filter(Boolean) })).filter((o) => o.values.length).slice(0, 3) : [],
      variants,
      trackStock: false,
      collections: (p.categories ?? []).map((c) => htmlToText(c.name, 80)).filter((c) => c && c.toLowerCase() !== "uncategorized").slice(0, 3),
      sourceUrl: https(p.permalink),
      live: true,
    });
  });
}

/* Any website: its schema.org product data (JSON-LD) ------------------------------------- */

type Json = Record<string, unknown>;

const asArray = <T,>(v: T | T[] | undefined | null): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const typeIs = (n: Json, t: string) => asArray(n["@type"] as string | string[]).some((x) => String(x).toLowerCase() === t.toLowerCase());

/** Every Product (and ProductGroup) in a page's JSON-LD, wherever it sits (@graph, ItemList…) */
export function jsonLdProducts(html: string): Json[] {
  const out: Json[] = [];
  const visit = (n: unknown, depth = 0) => {
    if (!n || typeof n !== "object" || depth > 6) return;
    if (Array.isArray(n)) return n.forEach((x) => visit(x, depth + 1));
    const o = n as Json;
    if (typeIs(o, "Product") || typeIs(o, "ProductGroup")) out.push(o);
    else for (const k of ["@graph", "itemListElement", "item", "mainEntity"]) visit(o[k], depth + 1);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {
      /* broken JSON-LD on the site: skip that block */
    }
  }
  return out;
}

const imageOf = (v: unknown): { src?: string; alt?: string }[] =>
  asArray(v as unknown[]).flatMap((x) => (typeof x === "string" ? [{ src: x }] : x && typeof x === "object" ? [{ src: String((x as Json).url ?? (x as Json).contentUrl ?? ""), alt: String((x as Json).caption ?? (x as Json).name ?? "") }] : []));

/** A schema.org VideoObject with a plain file we can copy */
function videoOf(v: unknown): ImportedProduct["video"] {
  for (const x of asArray(v as Json[])) {
    if (!x || typeof x !== "object") continue;
    const src = https(x.contentUrl);
    if (src && isVideoFile(src)) return { src, poster: imageOf(x.thumbnailUrl)[0]?.src && https(imageOf(x.thumbnailUrl)[0].src) };
  }
  return undefined;
}

/** MP4 or WebM, not a streaming playlist (.m3u8, .mpd), which can't be copied as one file */
export const isVideoFile = (u: string) => /\.(mp4|webm)(\?|$)/i.test(u) && !/\.(m3u8|mpd)/i.test(u);

function offerOf(v: unknown): { price: number; currency?: string; compareAt?: number; inStock: boolean } {
  const offers = asArray(v as Json | Json[]);
  const o = offers[0] ?? {};
  const currency = String(o.priceCurrency ?? (o.priceSpecification as Json | undefined)?.priceCurrency ?? "").toUpperCase() || undefined;
  const raw = o.price ?? o.lowPrice ?? (o.priceSpecification as Json | undefined)?.price;
  const availability = String(o.availability ?? "");
  return { price: toMinor(raw as string, currency), currency, inStock: !/OutOfStock|SoldOut|Discontinued/i.test(availability) };
}

export function fromJsonLd(html: string, pageUrl: string, fallbackCurrency: string): ImportedProduct[] {
  const seen = new Set<string>();
  return jsonLdProducts(html).flatMap((n): ImportedProduct[] => {
    const name = clean(n.name, 160);
    if (!name) return [];
    const variantsLd = asArray(n.hasVariant as Json[]).filter((v) => v && typeof v === "object");
    const top = offerOf(n.offers ?? variantsLd[0]?.offers);
    const currency = top.currency ?? fallbackCurrency;
    const key = String(n.sku ?? n.productGroupID ?? n["@id"] ?? n.url ?? name);
    if (seen.has(key)) return [];
    seen.add(key);
    const varyBy = asArray(n.variesBy as string[]).map((x) => String(x).replace(/^https?:\/\/schema\.org\//, ""));
    const variants: ImportedVariant[] = variantsLd.map((v, i) => {
      const off = offerOf(v.offers);
      const opts = varyBy.map((prop) => clean(v[prop.charAt(0).toLowerCase() + prop.slice(1)] ?? v[prop], 60));
      return { key: String(v.sku ?? i), title: opts.filter(Boolean).join(" / ") || clean(v.name, 120) || `Option ${i + 1}`, options: opts, sku: clean(v.sku, 32), price: off.price || top.price };
    });
    const brandName = typeof n.brand === "object" && n.brand ? (n.brand as Json).name : n.brand;
    return [
      product({
        key,
        title: name,
        description: htmlToText(String(n.description ?? "")),
        fulfilment: "physical",
        price: top.price,
        currency,
        sku: variants.length ? "" : clean(n.sku, 32),
        images: uniqImages([...imageOf(n.image), ...variantsLd.flatMap((v) => imageOf(v.image))]),
        video: videoOf(n.video),
        options: varyBy.length ? optionsFrom(varyBy, variants) : [],
        variants: varyBy.length ? variants : [],
        trackStock: false,
        collections: [clean(n.category, 80), clean(brandName, 80)].filter(Boolean).slice(0, 1),
        sourceUrl: https(n.url) ?? (/^https:/.test(pageUrl) ? pageUrl : undefined),
        live: top.inStock,
      }),
    ];
  });
}

/* Converting prices into the store's currency -------------------------------------------- */

/**
 * Prices in another currency are converted with the day's rates (units per US dollar), rounded to
 * whole units, and the product says so. Without a rate they're left as they are, with a warning.
 */
export function convertPrices(products: ImportedProduct[], to: string, rates: Record<string, number>): { products: ImportedProduct[]; warning?: string } {
  const other = [...new Set(products.map((p) => p.currency).filter((c) => c !== to))];
  if (!other.length) return { products };
  const missing = other.filter((c) => !rates[c] || !rates[to]);
  const conv = (amount: number, from: string) => {
    if (!rates[from] || !rates[to]) return amount;
    const fromDec = ZERO_DECIMAL.has(from) ? 1 : 100;
    const toDec = ZERO_DECIMAL.has(to) ? 1 : 100;
    const units = (amount / fromDec) * (rates[to] / rates[from]);
    return Math.max(0, Math.round(units)) * toDec;
  };
  return {
    products: products.map((p) =>
      p.currency === to || !rates[p.currency] || !rates[to]
        ? p
        : {
            ...p,
            currency: to,
            price: conv(p.price, p.currency),
            compareAt: p.compareAt ? conv(p.compareAt, p.currency) : undefined,
            variants: p.variants.map((v) => ({ ...v, price: conv(v.price, p.currency), compareAt: v.compareAt ? conv(v.compareAt, p.currency) : undefined })),
            problems: [...p.problems, `Price converted from ${p.currency}: check it.`],
          }
    ),
    warning: missing.length ? `Some prices are in ${missing.join(", ")} and couldn't be converted to ${to}. Check them before going live.` : `Prices were converted from ${other.join(", ")} to ${to} at today's rate. Check them before going live.`,
  };
}

/* From a link: words and price only ------------------------------------------------------ */

/**
 * A product read from a pasted link keeps its title, description and price, and its pictures and
 * video only when the creator asks for them. Variants, SKUs and stock stay behind.
 */
export function wordsAndPrice(p: ImportedProduct, withMedia = false): ImportedProduct {
  const base: Omit<ImportedProduct, "problems"> = {
    key: p.key,
    title: p.title,
    description: p.description,
    fulfilment: p.fulfilment,
    price: p.price,
    compareAt: p.compareAt && p.compareAt > p.price ? p.compareAt : undefined,
    currency: p.currency,
    sku: "",
    images: withMedia ? p.images.slice(0, 8) : [],
    video: withMedia ? p.video : undefined,
    options: [],
    variants: [],
    trackStock: false,
    collections: [],
    sourceUrl: p.sourceUrl,
    live: false,
  };
  return { ...base, problems: problemsOf(base) };
}

/** The AI's check of one product read from a link */
export interface FillCheck {
  key: string;
  title: string;
  description: string;
  /** Major units, as the page shows it; 0 when the page has no price */
  price: number;
  compareAt?: number;
  currency?: string;
  fulfilment: "digital" | "physical";
  /** What it changed or isn't sure of, in plain words */
  notes: string[];
}

/** Applies the AI's corrections. Anything it returns that doesn't make sense keeps what was read. */
export function applyCheck(p: ImportedProduct, c: FillCheck | undefined): ImportedProduct {
  if (!c) return p;
  const currency = c.currency && /^[A-Z]{3}$/.test(c.currency) ? c.currency : p.currency;
  const price = Number.isFinite(c.price) && c.price >= 0 && c.price < 10_000_000 ? toMinor(c.price, currency) : p.price;
  const compareAt = c.compareAt && Number.isFinite(c.compareAt) && c.compareAt > c.price ? toMinor(c.compareAt, currency) : undefined;
  const next: Omit<ImportedProduct, "problems"> = {
    ...p,
    title: clean(c.title, 160) || p.title,
    description: (c.description ?? "").trim().slice(0, 5000) || p.description,
    price,
    compareAt,
    currency,
    fulfilment: c.fulfilment === "digital" || c.fulfilment === "physical" ? c.fulfilment : p.fulfilment,
  };
  const notes = (c.notes ?? []).map((n) => clean(n, 200)).filter(Boolean).slice(0, 3);
  return { ...next, problems: [...problemsOf(next), ...notes] };
}

/** Currency symbols on price labels */
const SYMBOLS: [RegExp, string][] = [[/₹|Rs\.?\s/i, "INR"], [/US\$|\$/, "USD"], [/£/, "GBP"], [/€/, "EUR"], [/A\$/, "AUD"], [/C\$/, "CAD"], [/¥/, "JPY"]];

/** "Fancy" letters (𝐁𝐎𝐋𝐃, ｆｕｌｌ-ｗｉｄｔｈ) as plain ones, and decoration emoji gone */
export function plainLetters(s: string): string {
  return s.normalize("NFKC").replace(/[\u2700-\u27BF\uFE0F\u{1F300}-\u{1FAFF}]/gu, "").replace(/[ \t]+/g, " ").trim();
}

/**
 * A product from the page itself when it has no schema.org data: Amazon's layout (productTitle,
 * the price to pay, M.R.P., feature bullets, description), then the usual meta tags. Pure.
 */
export function fromPageMarkup(html: string, pageUrl: string, fallbackCurrency: string): ImportedProduct | undefined {
  const pick = (re: RegExp, from = html) => from.match(re)?.[1];
  const textOf = (h?: string) => (h ? plainLetters(htmlToText(h, 5000)) : "");
  const meta = (name: string) => pick(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]+content=["']([^"']*)`, "i"));

  let title = textOf(pick(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)) || textOf(meta("og:title")) || textOf(pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i));
  if (!title) return undefined;
  // Listing titles stuffed with features: the name is the first part
  if (title.length > 80 && title.includes(" | ")) title = title.split(" | ")[0];

  // Price: the block buyers see first, then meta tags
  const coreAt = html.search(/id=["'](?:corePriceDisplay_desktop_feature_div|corePrice_feature_div|apex_desktop)["']/i);
  const core = coreAt >= 0 ? html.slice(coreAt, coreAt + 8000) : "";
  const label = (s?: string) => (s && /\d/.test(s) ? s.trim() : undefined);
  const payLabel =
    label(pick(/priceToPay[\s\S]{0,400}?class=["']a-offscreen["']>([^<]+)</i, core)) ??
    label(pick(/class=["']a-price[^"']*["'][^>]*>\s*<span class=["']a-offscreen["']>([^<]+)</i, core)) ??
    (core ? label(`${pick(/a-price-symbol["']>([^<]*)</i, core) ?? ""}${pick(/a-price-whole["']>([\d,]+)/i, core) ?? ""}`) : undefined);
  const amount = payLabel ?? meta("product:price:amount") ?? meta("og:price:amount") ?? meta("price") ?? pick(/"priceAmount"\s*:\s*([\d.]+)/);
  const mrpLabel = label(pick(/a-text-price[^>]*>\s*<span class=["']a-offscreen["']>([^<]+)</i, core));
  const currency = (meta("product:price:currency") ?? meta("og:price:currency") ?? meta("priceCurrency") ?? SYMBOLS.find(([re]) => re.test(payLabel ?? ""))?.[1] ?? (/\.in$/i.test(new URL(pageUrl).hostname) ? "INR" : fallbackCurrency)).toUpperCase();
  const price = toMinor(amount, currency);
  const compareAt = toMinor(mrpLabel, currency);

  // Description: the feature bullets and the description, else the page's summary
  const bulletsAt = html.search(/id=["']feature-bullets["']/i);
  const bullets = bulletsAt >= 0 ? [...html.slice(bulletsAt, bulletsAt + 15000).matchAll(/<span class=["']a-list-item["']>([\s\S]*?)<\/span>/gi)].map((m) => textOf(m[1])).filter((t) => t.length > 2).slice(0, 10) : [];
  const descAt = html.search(/id=["']productDescription["']/i);
  const long = descAt >= 0 ? textOf(html.slice(descAt, descAt + 8000).replace(/^[^>]*>/, "").split(/<\/div>\s*<\/div>/i)[0]) : "";
  const summary = textOf(meta("og:description") ?? meta("description")).replace(/^[\w.]+:\s*(Buy\s+)?/i, "");
  const description = [bullets.map((b) => `• ${b}`).join("\n"), long].filter(Boolean).join("\n\n").slice(0, 5000) || summary;

  // Pictures: Amazon's gallery for this product (not the "similar items" further down), else og:image
  const galleryAt = html.search(/['"]colorImages['"]\s*:\s*\{\s*['"]initial['"]/);
  // The gallery is a JSON list inside a script: up to where that list's text ends
  const galleryEnd = galleryAt >= 0 ? html.slice(galleryAt, galleryAt + 60_000).indexOf("')") : -1;
  const gallery = galleryAt >= 0 ? html.slice(galleryAt, galleryAt + (galleryEnd >= 0 ? galleryEnd + 1 : 20_000)) : "";
  const shots = [...gallery.matchAll(/"hiRes"\s*:\s*"(https:[^"]+)"|"large"\s*:\s*"(https:[^"]+)"/g)];
  const byShot = new Map<string, string>();
  // One per shot: the high-resolution file when there is one
  for (const m of shots) {
    const src = m[1] ?? m[2];
    const id = src.match(/\/I\/([^._]+)/)?.[1] ?? src;
    if (m[1] || !byShot.has(id)) byShot.set(id, src);
  }
  const ogImages = [...html.matchAll(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["'](https:[^"']+)/gi)].map((m) => m[1]);
  const images = uniqImages([...byShot.values(), ...(byShot.size ? [] : ogImages)].map((src) => ({ src, alt: title })));
  const ogVideo = [...html.matchAll(/<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["'](https:[^"']+)/gi)].map((m) => m[1]).find(isVideoFile);

  const canonical = pick(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
  const host = new URL(pageUrl).hostname;
  const sourceUrl = canonical && canonical.startsWith("https://") && new URL(canonical).hostname === host ? canonical : pageUrl.split("?")[0];
  return product({
    key: sourceUrl,
    title,
    description,
    fulfilment: "physical",
    price,
    compareAt: compareAt > price ? compareAt : undefined,
    currency,
    sku: "",
    images,
    video: ogVideo ? { src: ogVideo } : undefined,
    options: [],
    variants: [],
    trackStock: false,
    collections: [],
    sourceUrl,
    live: true,
  });
}
