/**
 * Serving a store on its own domain. A request whose host isn't one of ours is looked up; if it
 * belongs to a store, its pages are served from /s/<store> without the visitor ever seeing that.
 * The buyer pages that live at the top level (orders, invoices, lookup) and the API stay where they are.
 */
const GLOBAL = ["/order", "/success", "/lookup", "/invoice", "/download", "/checkout", "/api", "/_next", "/favicon.ico"];

export function isAppHost(host: string, siteUrl: string | undefined): boolean {
  const h = host.toLowerCase().split(":")[0];
  let own = "";
  try {
    own = siteUrl ? new URL(siteUrl).hostname.toLowerCase() : "";
  } catch {
    /* no valid site address set */
  }
  return !h || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost") || h.endsWith(".vercel.app") || h === own || h === `www.${own}`;
}

/** Where a custom domain's request is really served, or null when it should be served as it is */
export function rewriteTarget(pathname: string, slug: string): string | null {
  if (GLOBAL.some((g) => pathname === g || pathname.startsWith(`${g}/`))) return null;
  if (pathname === "/s" || pathname.startsWith("/s/")) return null;
  return `/s/${slug}${pathname === "/" ? "" : pathname}`;
}

const cache = new Map<string, { slug: string | null; at: number }>();
const TTL = 60_000;

/** The store a host belongs to (cached for a minute, so every request isn't a database call) */
export async function resolveHost(host: string, base: string, anonKey: string, now = Date.now(), fetcher: typeof fetch = fetch): Promise<string | null> {
  const key = host.toLowerCase();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL) return hit.slug;
  let slug: string | null = null;
  try {
    const res = await fetcher(`${base}/rest/v1/rpc/resolve_domain`, { method: "POST", headers: { apikey: anonKey, "content-type": "application/json" }, body: JSON.stringify({ p_host: key }), signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const v = (await res.json()) as unknown;
      slug = typeof v === "string" && /^[a-z0-9-]+$/.test(v) ? v : null;
    } else return hit?.slug ?? null;
  } catch {
    return hit?.slug ?? null;
  }
  cache.set(key, { slug, at: now });
  if (cache.size > 2000) cache.clear();
  return slug;
}
