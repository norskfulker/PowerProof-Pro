import "server-only";
import { fromJsonLd, fromShopifyPublic, fromWooStore, htmlToText, type ImportedProduct, type ImportPreview, type ShopifyPublicProduct, type WooStoreProduct } from "../../import/map";
import { FetchBlocked, safeFetch, safeJson } from "../safe-fetch";

/**
 * Reading a whole shop from its address, for "Add from a link": the products Shopify and
 * WooCommerce publish, or any site's schema.org product pages. Public data only.
 */

/** A problem the creator can act on (site not reachable, no products found…) */
export class ImportError extends Error {}

/* A shop's catalogue, from its address ----------------------------------------------------- */

const metaContent = (html: string, re: RegExp) => html.match(re)?.[1]?.trim();

function siteInfo(html: string, origin: string): ImportPreview["store"] {
  const name = metaContent(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i) ?? htmlToText(metaContent(html, /<title[^>]*>([^<]+)/i) ?? "", 80).split(/\s[|–—-]\s/)[0];
  const color = metaContent(html, /<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{6})/i);
  const icon = metaContent(html, /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)/i);
  const logo = icon ? new URL(icon, origin).toString() : undefined;
  return { name: name || undefined, color, logo: logo?.startsWith("https://") ? logo : undefined };
}

/** A Shopify shop's currency, from the details it publishes about itself */
export async function shopifyCurrency(origin: string): Promise<string | undefined> {
  const r = await safeJson<{ currency?: string }>(`${origin}/meta.json`).catch(() => undefined);
  return r?.data?.currency && /^[A-Z]{3}$/.test(r.data.currency) ? r.data.currency : undefined;
}

/** Shopify and WooCommerce sites publish their products; anything else, its schema.org product pages */
export async function previewWebsite(url: string, fallbackCurrency: string): Promise<ImportPreview> {
  const start = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  const origin = `https://${start.hostname}`;
  let home: string;
  try {
    home = (await safeFetch(`${origin}/`, { accept: "text/html" })).text();
  } catch (e) {
    throw new ImportError(e instanceof FetchBlocked ? e.message : "We couldn't open that site. Check the address and that it's online.");
  }
  const store = siteInfo(home, origin);
  const warnings: string[] = [];

  // Shopify: /products.json
  const shopifyProducts: ShopifyPublicProduct[] = [];
  for (let page = 1; page <= 4; page++) {
    const r = await safeJson<{ products?: ShopifyPublicProduct[] }>(`${origin}/products.json?limit=250&page=${page}`, { maxBytes: 8_000_000 }).catch(() => undefined);
    if (!r?.data?.products?.length) break;
    shopifyProducts.push(...r.data.products);
    if (r.data.products.length < 250) break;
  }
  if (shopifyProducts.length) {
    // products.json is in the shop's own currency; the page may show a visitor's local one
    const currency = (await shopifyCurrency(origin)) ?? metaContent(home, /Shopify\.currency\s*=\s*\{[^}]*"active":"([A-Z]{3})"/) ?? metaContent(home, /<meta[^>]+property=["'](?:og:price:currency|product:price:currency)["'][^>]+content=["']([A-Z]{3})/i) ?? fallbackCurrency;
    return { source: "website", label: start.hostname, store: { ...store, currency }, products: fromShopifyPublic(shopifyProducts, currency, origin), warnings: ["Read from the site's public products, so stock counts didn't come across."] };
  }

  // WooCommerce: the Store API
  const woo: WooStoreProduct[] = [];
  for (let page = 1; page <= 5; page++) {
    const r = await safeJson<WooStoreProduct[]>(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, { maxBytes: 8_000_000 }).catch(() => undefined);
    if (!Array.isArray(r?.data) || !r.data.length) break;
    woo.push(...r.data);
    if (r.data.length < 100) break;
  }
  if (woo.length) return { source: "website", label: start.hostname, store, products: fromWooStore(woo, fallbackCurrency), warnings: ["Read from the site's public shop, so stock counts and variant prices may need checking."] };

  // Anything else: product data on the pages (the given page, the home page, and product pages from the sitemap)
  const pages = new Set<string>([start.toString(), `${origin}/`]);
  try {
    const sitemap = (await safeFetch(`${origin}/sitemap.xml`, { maxBytes: 3_000_000 })).text();
    const locs = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    const nested = locs.filter((l) => /sitemap.*\.xml/i.test(l) && /product/i.test(l)).slice(0, 2);
    for (const n of nested) locs.push(...[...(await safeFetch(n, { maxBytes: 3_000_000 })).text().matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]));
    locs.filter((l) => /\/(product|products|shop|item|p)\//i.test(l) && l.startsWith(origin)).slice(0, 60).forEach((l) => pages.add(l));
  } catch {
    /* no sitemap */
  }
  const products: ImportedProduct[] = [];
  const seen = new Set<string>();
  for (const page of [...pages].slice(0, 62)) {
    try {
      const html = page === `${origin}/` ? home : (await safeFetch(page, { accept: "text/html" })).text();
      for (const p of fromJsonLd(html, page, fallbackCurrency)) {
        if (seen.has(p.key)) continue;
        seen.add(p.key);
        products.push(p);
      }
    } catch {
      /* a page that won't open is skipped */
    }
  }
  if (!products.length) throw new ImportError("We couldn't find products on that site. Product pages need schema.org product data (most shop builders add it), or import from the platform instead.");
  if (pages.size >= 62) warnings.push("Read the first 60 product pages. Run it again for more.");
  return { source: "website", label: start.hostname, store, products, warnings };
}
