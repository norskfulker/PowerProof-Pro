import "server-only";
import { GoogleGenAI } from "@google/genai";
import { applyCheck, fromJsonLd, fromPageMarkup, plainLetters, fromShopifyPublic, htmlToText, shopifyVideo, toMajor, wordsAndPrice, type FillCheck, type ImportedProduct, type ImportPreview, type ShopifyProductJs, type ShopifyPublicProduct } from "../../import/map";
import { GEMINI_PAGE_MODEL, aiConnected } from "../../pages/ai-run";
import { FetchBlocked, safeFetch, safeJson } from "../safe-fetch";
import { ImportError, previewWebsite, shopifyCurrency } from "./sources";

/**
 * Paste a link, get products: a product page gives that product, a shop's address gives its
 * catalogue. The title, description and price come across, and the pictures and a video when the
 * creator asks for them. AI checks what was read: the right title, a clean description, the real price.
 */

const PAGE_TEXT = 12_000;
/** Products the AI checks in one go, and in all */
const CHECK_BATCH = 25;
const CHECK_MAX = 100;

/** Some shops answer an unknown reader with a block page; a browser-like accept header helps */
const HTML = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8";

/** Shopify product pages: /products/handle (also inside a collection) */
const shopifyHandle = (u: URL) => u.pathname.match(/\/products\/([^/?#.]+)\/?$/)?.[1];

/** The page as words for the AI: headings, prices and paragraphs, no scripts or menus */
function pageText(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const title = html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "";
  const metas = [...html.matchAll(/<meta\s+[^>]*(?:property|name)=["'](og:title|og:description|description|og:price:amount|og:price:currency|product:price:amount|product:price:currency)["'][^>]*>/gi)]
    .map((m) => `${m[1]}: ${m[0].match(/content=["']([^"']*)/i)?.[1] ?? ""}`);
  const body = htmlToText(main.replace(/<\s*(nav|header|footer|svg|noscript|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ""), PAGE_TEXT);
  return plainLetters([`title: ${htmlToText(title, 200)}`, ...metas, "", body].join("\n")).slice(0, PAGE_TEXT);
}

/** The currency the page shows prices in */
function pageCurrency(html: string): string | undefined {
  const m =
    html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/) ??
    html.match(/<meta[^>]+(?:property|itemprop)=["'](?:og:price:currency|product:price:currency|priceCurrency)["'][^>]+content=["']([A-Z]{3})/i) ??
    html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/);
  return m?.[1]?.toUpperCase();
}

const BLOCKED = "That site blocks automatic reading. Copy the title, description and price into a new product instead.";

function looksBlocked(html: string): boolean {
  return /captcha|robot check|are you a human|access denied|enable javascript and cookies/i.test(html.slice(0, 20_000)) && !/"@type"\s*:\s*"Product"/i.test(html);
}

/** The products on the page (or in the shop) with everything but words and price left behind */
async function readProducts(url: URL, currency: string): Promise<{ products: ImportedProduct[]; label: string; text?: string; whole: boolean; warnings: string[]; videoStream?: boolean }> {
  const origin = `https://${url.hostname}`;
  let html: string;
  try {
    const res = await safeFetch(url.toString(), { accept: HTML, maxBytes: 5_000_000, headers: { "accept-language": "en-IN,en;q=0.9" } });
    if (res.status === 404) throw new ImportError("That page doesn't exist. Check the link.");
    if (res.status >= 400) throw new ImportError(BLOCKED);
    html = res.text();
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(e instanceof FetchBlocked ? e.message : "We couldn't open that link. Check it and that the site is online.");
  }
  const blocked = looksBlocked(html);
  const isProductPage = /\/(dp|gp\/product|product|products|item|itm|p)\//i.test(url.pathname);
  if (blocked && isProductPage && !shopifyHandle(url)) throw new ImportError(BLOCKED);
  const shown = (blocked ? undefined : pageCurrency(html)) ?? currency;

  // A Shopify product page has its product as data at the same address (its prices in the shop's currency)
  const handle = shopifyHandle(url);
  if (handle) {
    const [r, js] = await Promise.all([
      safeJson<{ product?: ShopifyPublicProduct }>(`${origin}/products/${handle}.json`).catch(() => undefined),
      safeJson<ShopifyProductJs>(`${origin}/products/${handle}.js`).catch(() => undefined),
    ]);
    if (r?.data?.product) {
      // The feed is in the shop's own currency; the page may show a visitor's local one
      const cur = (await shopifyCurrency(origin)) ?? (blocked ? undefined : pageCurrency(html)) ?? currency;
      const video = shopifyVideo(js?.data);
      return { products: fromShopifyPublic([r.data.product], cur, origin).map((p) => ({ ...p, video })), label: url.hostname, text: blocked ? undefined : pageText(html), whole: false, warnings: [] };
    }
    if (blocked) throw new ImportError(BLOCKED);
  }

  // A video that only plays as a stream (Amazon's do) can't be copied as one file
  const videoStream = /\.m3u8|\.mpd\b/i.test(html);
  const onPage = blocked ? [] : fromJsonLd(html, url.toString(), shown);
  if (onPage.length) return { products: onPage, label: url.hostname, text: pageText(html), whole: false, warnings: [], videoStream };

  // A shop's address (home, a collection): read the catalogue
  if (!isProductPage) {
    try {
      const shop = await previewWebsite(url.toString(), currency);
      return { products: shop.products, label: shop.label, whole: true, warnings: shop.warnings.filter((w) => !/stock|variant/i.test(w)) };
    } catch {
      /* not a shop we can read: try the page itself */
    }
  }
  if (blocked) throw new ImportError(BLOCKED);
  // No product data: the page's own layout (Amazon and the like), then the AI reads its words
  const marked = fromPageMarkup(html, url.toString(), currency);
  if (marked && (marked.price > 0 || marked.description)) return { products: [marked], label: url.hostname, text: pageText(html), whole: false, warnings: [], videoStream };
  return { products: [], label: url.hostname, text: pageText(html), whole: false, warnings: [] };
}

/* The AI check ------------------------------------------------------------------------------ */

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "The key given, or a new short key for a product found only in the page text" },
          title: { type: "string", description: "The product's name, without the shop's name, SEO filler or promo words" },
          description: { type: "string", description: "Plain text. The product's own facts: what it is, what's included, size, material, how to use it. Nothing about the shop" },
          price: { type: "number", description: "The price a buyer pays now, in major units (499.00, not 49900). 0 when there's no price" },
          compareAt: { type: "number", description: "The crossed-out original price, only if the page shows one" },
          currency: { type: "string", description: "ISO 4217 code, like INR or USD" },
          fulfilment: { type: "string", enum: ["physical", "digital"], description: "physical if it is shipped, digital if it is downloaded or accessed online" },
          notes: { type: "array", items: { type: "string" }, description: "Up to 3 short notes for the seller about what you fixed or aren't sure of. Empty if all is clear" },
        },
        required: ["key", "title", "description", "price", "fulfilment", "notes"],
      },
    },
  },
  required: ["products"],
};

const CHECK_PROMPT = `You check product details read automatically from a web page, before a seller adds them to their own store. Return each product with these fields correct:
- title: the product's real name. Remove the shop or brand-site name, "Buy … online", "| Free shipping", emoji and keyword stuffing. Keep the brand if it's part of the product's name.
- description: plain text in short paragraphs or "• " bullet lines. Keep the product's facts. Remove anything about the shop itself: shipping, returns, delivery times, offers, reviews, "add to cart", contact details, links, other products. Don't invent facts. If the page has no description, write one or two plain sentences from what the page does say.
- price: the price a buyer pays now, in major units. If the data and the page disagree, trust what the page shows to buyers. If you see a sale price and an original price, price is the sale price and compareAt the original.
- currency: from the page (₹ is INR, $ on an Indian site is still USD unless the page says otherwise).
- fulfilment: physical or digital.
- notes: tell the seller briefly what to double-check, such as "Price is for the smallest size". Leave it empty when nothing needs saying. Don't mention routine things: prices are converted to the seller's currency for them, and taking the M.R.P. or crossed-out price as compareAt is expected.
Only return real products for sale. Never return a page that isn't a product (a block page, a login page, a category list without products).`;

async function aiCheck(products: ImportedProduct[], text: string | undefined, currency: string): Promise<FillCheck[] | undefined> {
  if (!aiConnected()) return undefined;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || GEMINI_PAGE_MODEL;
  const ask = async (list: ImportedProduct[], withText: boolean): Promise<FillCheck[]> => {
    const read = list.map((p) => ({ key: p.key, title: p.title, description: p.description.slice(0, 2500), price: toMajor(p.price, p.currency), compareAt: p.compareAt ? toMajor(p.compareAt, p.currency) : undefined, currency: p.currency, fulfilment: p.fulfilment }));
    const parts = [
      read.length ? `Read from the page's product data (prices in major units):\n${JSON.stringify(read)}` : "No product data was found. Find the product in the page text below, if there is one.",
      withText && text ? `The page as buyers see it:\n${text}` : "",
      `The seller's store sells in ${currency}.`,
    ].filter(Boolean);
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: parts.join("\n\n") }] }],
      config: { systemInstruction: CHECK_PROMPT, responseMimeType: "application/json", responseJsonSchema: CHECK_SCHEMA, maxOutputTokens: 16000, abortSignal: AbortSignal.timeout(60_000) },
    });
    const out = JSON.parse(res.text ?? "{}") as { products?: FillCheck[] };
    return Array.isArray(out.products) ? out.products : [];
  };
  try {
    if (!products.length) return await ask([], true);
    const batches: ImportedProduct[][] = [];
    for (let i = 0; i < Math.min(products.length, CHECK_MAX); i += CHECK_BATCH) batches.push(products.slice(i, i + CHECK_BATCH));
    // One page's products are checked against the page; a whole shop's, against their own data
    return (await Promise.all(batches.map((b) => ask(b, products.length <= 3)))).flat();
  } catch (e) {
    console.error("[import/link] check", e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** A product the AI found in a page's words, with no product data to start from */
function fromCheck(c: FillCheck, url: string, currency: string): ImportedProduct {
  const blank: ImportedProduct = { key: `${url}#${c.key || "1"}`, title: "", description: "", fulfilment: "physical", price: 0, currency, sku: "", images: [], options: [], variants: [], trackStock: false, collections: [], sourceUrl: url, live: false, problems: [] };
  return applyCheck(wordsAndPrice(blank), c);
}

/** Reads a pasted link: its products' words and price, checked by AI */
export async function previewLink(input: string, currency: string, opts: { media: boolean }): Promise<ImportPreview> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new ImportError("That doesn't look like a link. Paste the address of a product or a shop.");
  }
  if (url.protocol === "http:") url.protocol = "https:";
  const read = await readProducts(url, currency);
  const base = read.products.map((p) => wordsAndPrice(p, opts.media));
  const checks = await aiCheck(base, read.text, currency);
  const warnings = [...read.warnings];

  let products: ImportedProduct[];
  if (!base.length) {
    if (!checks) throw new ImportError(aiConnected() ? "We couldn't find a product on that page. Try the product's own page." : "That page has no product data we can read. Try the product's own page.");
    products = checks.filter((c) => c.title?.trim()).slice(0, 5).map((c) => fromCheck(c, url.toString(), currency));
    if (!products.length) throw new ImportError("We couldn't find a product on that page. Try the product's own page.");
  } else {
    const byKey = new Map((checks ?? []).map((c) => [c.key, c]));
    products = base.map((p) => applyCheck(p, byKey.get(p.key)));
    if (!checks) warnings.push("AI couldn't check these just now, so read each title, description and price before going live.");
    else if (base.length > CHECK_MAX) warnings.push(`AI checked the first ${CHECK_MAX}. Read the rest before going live.`);
  }
  if (!opts.media) warnings.push("Only titles, descriptions and prices come across. Add your own pictures on each product.");
  else if (!products.some((p) => p.images.length)) warnings.push("That page had no pictures we could copy. Add your own on each product.");
  if (opts.media && read.videoStream && !products.some((p) => p.video)) warnings.push("Its video plays as a stream, which can't be copied. Add a video file on the product if you have one.");
  return { source: "website", label: read.whole ? read.label : url.hostname + url.pathname.replace(/\/$/, ""), store: {}, products, warnings };
}
