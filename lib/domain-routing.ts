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
  return !h || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost") || h.endsWith(".workers.dev") || h === own || h === `www.${own}`;
}

/** PowerProof's own production address (not local or preview hosts), where stores can send visitors on to their domain */
export function isSiteHost(host: string, siteUrl: string | undefined): boolean {
  const h = host.toLowerCase().split(":")[0];
  try {
    const own = siteUrl ? new URL(siteUrl).hostname.toLowerCase() : "";
    return !!own && (h === own || h === `www.${own}`);
  } catch {
    return false;
  }
}

/** For www.<domain>, the bare domain it should send visitors to (null for any other host) */
export function wwwTarget(host: string): string | null {
  const h = host.toLowerCase().split(":")[0];
  return h.startsWith("www.") && h.split(".").length >= 3 ? h.slice(4) : null;
}

/** A store page on PowerProof's address: the store and the rest of the path */
export function storePath(pathname: string): { slug: string; rest: string } | null {
  const m = pathname.match(/^\/s\/([a-z0-9-]+)(\/.*)?$/);
  return m ? { slug: m[1], rest: m[2] ?? "/" } : null;
}

/**
 * On a store's own domain, links written as /s/<store>/... are sent to the clean address (so the
 * domain never shows PowerProof's path). Another store's path is left alone. null = nothing to do.
 */
export function cleanPath(pathname: string, slug: string): string | null {
  const p = storePath(pathname);
  return p && p.slug === slug ? p.rest : null;
}

/** Where a custom domain's request is really served, or null when it should be served as it is */
export function rewriteTarget(pathname: string, slug: string): string | null {
  if (GLOBAL.some((g) => pathname === g || pathname.startsWith(`${g}/`))) return null;
  if (pathname === "/s" || pathname.startsWith("/s/")) return null;
  return `/s/${slug}${pathname === "/" ? "" : pathname}`;
}

const TTL = 60_000;

/**
 * One database function, asked at most once a minute per key, so every request isn't a database
 * call. An answer that doesn't look right is treated as none; when the database can't be reached,
 * the last answer is kept.
 */
function cachedLookup(fn: string, param: string, valid: RegExp) {
  const cache = new Map<string, { value: string | null; at: number }>();
  return async (key: string, base: string, anonKey: string, now = Date.now(), fetcher: typeof fetch = fetch): Promise<string | null> => {
    key = key.toLowerCase();
    const hit = cache.get(key);
    if (hit && now - hit.at < TTL) return hit.value;
    let value: string | null = null;
    try {
      const res = await fetcher(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: anonKey, "content-type": "application/json" }, body: JSON.stringify({ [param]: key }), signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const v = (await res.json()) as unknown;
        value = typeof v === "string" && valid.test(v) ? v.toLowerCase() : null;
      } else return hit?.value ?? null;
    } catch {
      return hit?.value ?? null;
    }
    cache.set(key, { value, at: now });
    if (cache.size > 2000) cache.clear();
    return value;
  };
}

/** The store a host belongs to */
export const resolveHost = cachedLookup("resolve_domain", "p_host", /^[a-z0-9-]+$/);

/** A store's live domain, when its free address should send visitors there */
export const primaryDomain = cachedLookup("primary_domain", "p_slug", /^([a-z0-9-]+\.)+[a-z]{2,}$/i);
