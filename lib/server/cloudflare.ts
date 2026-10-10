import type { DomainIssue } from "../types";

/**
 * Custom domains through Cloudflare for SaaS (custom hostnames on PowerProof's own zone). The
 * Worker answers every hostname on that zone (a `*\/*` route, wrangler.jsonc), so a creator's
 * domain reaches the app as soon as Cloudflare has validated it and issued its certificate.
 *
 *   CLOUDFLARE_API_TOKEN   a token with "SSL and Certificates: Edit" on the zone
 *   CLOUDFLARE_ZONE_ID     the zone the custom hostnames live on (PowerProof's domain)
 *   CLOUDFLARE_CNAME_TARGET  where creators point their CNAME, like customers.powerproof.store
 *                          (a proxied record on that zone pointing to the fallback origin)
 *   CLOUDFLARE_APEX_IPS    optional, comma separated: the addresses for bare domains when the zone
 *                          has apex proxying; without it, bare domains need a CNAME at the root
 *
 * Without the first three nothing is attached and the screen says domains aren't connected here.
 */
export interface CloudflareConfig {
  token: string;
  zoneId: string;
  target: string;
  apexIps: string[];
}

export function cloudflareConfig(env: Record<string, string | undefined> = process.env): CloudflareConfig | null {
  const target = env.CLOUDFLARE_CNAME_TARGET?.trim().toLowerCase().replace(/\.$/, "");
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID || !target) return null;
  const apexIps = (env.CLOUDFLARE_APEX_IPS ?? "").split(",").map((s) => s.trim()).filter((s) => /^[0-9.]+$|^[0-9a-f:]+$/i.test(s));
  return { token: env.CLOUDFLARE_API_TOKEN, zoneId: env.CLOUDFLARE_ZONE_ID, target, apexIps };
}

export class DomainApiError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

interface Envelope<T> {
  success: boolean;
  errors?: { code?: number; message?: string }[];
  result: T;
}

async function call<T>(cfg: CloudflareConfig, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(cfg.zoneId)}${path}`, {
    method,
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({ success: false }))) as Envelope<T>;
  if (!res.ok || !json.success) {
    const err = json.errors?.[0];
    console.error(`[cloudflare] ${method} ${path} answered ${res.status}: ${err?.code ?? ""} ${err?.message ?? ""}`);
    const msg = (err?.message ?? "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("already exists")) throw new DomainApiError("That domain is already connected.", 409);
    if (msg.includes("in use") || msg.includes("another zone") || msg.includes("belongs to")) throw new DomainApiError("That domain is already connected to another site on Cloudflare.", 409);
    if (res.status === 401 || res.status === 403) throw new DomainApiError("The hosting connection isn't allowed to do that. Check the Cloudflare token's access.", 502);
    throw new DomainApiError(err?.message ?? "Cloudflare didn't accept that.", res.status >= 500 ? 502 : 400);
  }
  return json.result;
}

export interface CustomHostname {
  id: string;
  hostname: string;
  /** "active" once Cloudflare has checked the domain is pointed here */
  status: string;
  ssl?: {
    status?: string;
    validation_records?: { txt_name?: string; txt_value?: string; http_url?: string; http_body?: string; cname?: string; cname_target?: string }[];
    validation_errors?: { message?: string }[];
  };
  ownership_verification?: { name?: string; type?: string; value?: string };
  verification_errors?: string[];
}

/** A certificate checked over HTTP: once the CNAME points here it's issued with nothing more to add */
const SSL = { method: "http", type: "dv", settings: { min_tls_version: "1.2" } };

export const createHostname = (cfg: CloudflareConfig, host: string) => call<CustomHostname>(cfg, "POST", "/custom_hostnames", { hostname: host, ssl: SSL });
export const findHostname = async (cfg: CloudflareConfig, host: string) =>
  (await call<CustomHostname[]>(cfg, "GET", `/custom_hostnames?hostname=${encodeURIComponent(host)}`)).find((h) => h.hostname.toLowerCase() === host.toLowerCase()) ?? null;
/** Asks Cloudflare to look again (and start a fresh certificate check) */
export const refreshHostname = (cfg: CloudflareConfig, id: string) => call<CustomHostname>(cfg, "PATCH", `/custom_hostnames/${encodeURIComponent(id)}`, { ssl: SSL });
export const deleteHostname = (cfg: CloudflareConfig, id: string) => call<unknown>(cfg, "DELETE", `/custom_hostnames/${encodeURIComponent(id)}`);

/** The hostname, made if it isn't there yet (a retry, or one removed on Cloudflare's side) */
export async function ensureHostname(cfg: CloudflareConfig, host: string): Promise<CustomHostname> {
  const found = await findHostname(cfg, host);
  if (found) return found;
  return createHostname(cfg, host).catch(async (e) => {
    if (e instanceof DomainApiError && e.status === 409) {
      const again = await findHostname(cfg, host);
      if (again) return again;
    }
    throw e;
  });
}

export const isLive = (h: CustomHostname | null | undefined) => !!h && h.status === "active" && h.ssl?.status === "active";

/** Where the name points right now, from public DNS (Cloudflare's resolver over HTTPS) */
export async function lookupDns(host: string, fetcher: typeof fetch = fetch): Promise<{ cnames: string[]; a: string[] }> {
  const ask = async (type: "CNAME" | "A") => {
    const res = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: "application/dns-json" }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    const json = (await res.json().catch(() => ({}))) as { Answer?: { type: number; data: string }[] };
    const want = type === "CNAME" ? 5 : 1;
    return (json.Answer ?? []).filter((a) => a.type === want).map((a) => a.data.toLowerCase().replace(/\.$/, ""));
  };
  const [cnames, a] = await Promise.all([ask("CNAME").catch(() => []), ask("A").catch(() => [])]);
  return { cnames, a };
}

/* Pure parts -------------------------------------------------------- */

/** Second-level suffixes where the "apex" has three labels, like shop.co.in */
const SECOND_LEVEL = new Set(["co.in", "org.in", "net.in", "gov.in", "ac.in", "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "org.au", "co.nz", "co.za", "com.br", "com.sg", "com.my", "co.jp", "com.ae"]);

export const isApex = (host: string) => {
  const parts = host.split(".");
  return parts.length === 2 || (parts.length === 3 && SECOND_LEVEL.has(parts.slice(1).join(".")));
};

/** The registered domain a host sits on (where its DNS records are edited) */
export function apexOf(host: string): string {
  const parts = host.split(".");
  const n = parts.length >= 3 && SECOND_LEVEL.has(parts.slice(-2).join(".")) ? 3 : 2;
  return parts.slice(-n).join(".");
}

/** A record name the way DNS screens want it: relative to the registered domain, "@" for the domain itself */
export function relativeName(name: string, host: string): string {
  const apex = apexOf(host);
  const n = name.toLowerCase().replace(/\.$/, "");
  return n === apex ? "@" : n.endsWith(`.${apex}`) ? n.slice(0, -(apex.length + 1)) : n;
}

/** The www name that goes with a bare domain (the app sends it on to the bare domain) */
export const wwwOf = (host: string) => (isApex(host) ? `www.${host}` : null);

export interface DnsRecord {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
  /** Shown under the record: when it's optional, or what the DNS host may call it */
  note?: string;
}

/**
 * The records the owner must add: where to point the name (and www, for a bare domain), plus the
 * ownership check Cloudflare offers while the domain is pending.
 */
export function recordsFor(host: string, cfg: Pick<CloudflareConfig, "target" | "apexIps">, hostname?: CustomHostname | null, www = false): DnsRecord[] {
  const out: DnsRecord[] = [];
  if (isApex(host)) {
    if (cfg.apexIps.length) for (const ip of cfg.apexIps) out.push({ type: "A", name: "@", value: ip });
    else out.push({ type: "CNAME", name: "@", value: cfg.target, note: "A CNAME on the bare domain. Cloudflare DNS allows it (CNAME flattening); elsewhere it may be called ALIAS or ANAME. If your DNS host has none of these, connect a subdomain like shop." + host + " instead." });
    if (www) out.push({ type: "CNAME", name: "www", value: cfg.target });
  } else {
    out.push({ type: "CNAME", name: relativeName(host, host), value: cfg.target });
  }
  const own = hostname?.ownership_verification;
  if (own?.name && own.value && hostname?.status !== "active") out.push({ type: "TXT", name: relativeName(own.name, host), value: own.value, note: "Optional: proves the domain is yours, so it can go live a little sooner." });
  return out;
}

/** Turns what Cloudflare and public DNS show into the problem the screen explains */
export function issueFrom(h: CustomHostname | null, dns: { cnames: string[]; a: string[] }, host: string, cfg: Pick<CloudflareConfig, "target" | "apexIps">): DomainIssue | null {
  if (isLive(h)) return null;
  const errors = [...(h?.verification_errors ?? []), ...(h?.ssl?.validation_errors ?? []).map((e) => e.message ?? "")].join(" ").toLowerCase();
  if (errors.includes("caa")) return "caa_blocks_ssl";
  const target = cfg.target.toLowerCase();
  if (dns.cnames.length) return dns.cnames.some((c) => c === target) ? "propagation_slow" : "wrong_target";
  if (dns.a.length) {
    // A bare domain with a flattened CNAME shows up as addresses: trust Cloudflare's own check then
    if (cfg.apexIps.length) return dns.a.every((a) => cfg.apexIps.includes(a)) ? "propagation_slow" : dns.a.some((a) => cfg.apexIps.includes(a)) ? "conflicting_record" : "wrong_target";
    return isApex(host) && !errors ? "propagation_slow" : "wrong_target";
  }
  return "missing_record";
}
