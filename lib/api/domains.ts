import { commit, db } from "../mock/db";
import { PLAN_LIMITS } from "../plans";
import type { DnsProviderId, DnsRecord, DomainIssue, DomainStatus, StoreDomain, StoreDomains } from "../types";
import { LimitError } from "./account";
import { ownedScopes } from "./scope";
import { ApiError, call, notFound } from "./client";

/**
 * Custom domains (Part 7B). Every screen talks to these functions only. Today a small simulator
 * stands in for DNS lookups and certificate issuing; the dev panel on /design can force any status
 * or problem. A backend replaces the bodies and keeps the signatures.
 */

export const SUBDOMAIN_ROOT = "powerproof.store";
export const DNS_TARGET = { a: "76.76.21.21", cname: "stores.powerproof.store" };

export interface DnsProvider {
  id: DnsProviderId;
  name: string;
  /** One-click setup through the provider's own approval page */
  auto: boolean;
  /** Short plain guide for manual setup */
  steps: string[];
}

export const DNS_PROVIDERS: Record<DnsProviderId, DnsProvider> = {
  godaddy: { id: "godaddy", name: "GoDaddy", auto: true, steps: ["Sign in to GoDaddy and open My Products.", "Next to your domain, choose DNS.", "Add each record below, then Save."] },
  cloudflare: { id: "cloudflare", name: "Cloudflare", auto: true, steps: ["Open your site in the Cloudflare dashboard.", "Go to DNS › Records and choose Add record.", "Add each record below. Set the proxy status to DNS only (grey cloud)."] },
  namecheap: { id: "namecheap", name: "Namecheap", auto: false, steps: ["Sign in and open Domain List.", "Choose Manage next to your domain, then Advanced DNS.", "Under Host Records, choose Add New Record for each record below."] },
  hostinger: { id: "hostinger", name: "Hostinger", auto: false, steps: ["Open hPanel and choose Domains.", "Pick your domain, then DNS / Nameservers.", "Add each record below and save."] },
  squarespace: { id: "squarespace", name: "Squarespace Domains (formerly Google Domains)", auto: false, steps: ["Open Domains in your Squarespace account.", "Pick your domain, then DNS › DNS Settings.", "Under Custom records, add each record below."] },
  other: { id: "other", name: "your DNS provider", auto: false, steps: ["Sign in where you bought the domain.", "Find the DNS, DNS records or Zone editor page.", "Add each record below exactly as shown. Changes can take up to an hour."] },
};

export const DOMAIN_ISSUES: Record<DomainIssue, { title: string; reason: string; fix: string }> = {
  wrong_target: { title: "The record points to the wrong place", reason: "Your A record points somewhere else, so buyers would reach another site.", fix: `Change the A record for @ to ${DNS_TARGET.a}. Delete any other A records for @.` },
  missing_record: { title: "We can't find the records yet", reason: "There are no records for this domain that point to PowerProof.", fix: "Add the records shown below exactly as written, then choose Verify now." },
  conflicting_record: { title: "Two records clash", reason: "There's also an AAAA or older A record for @, so some visitors go to the old site.", fix: "Delete every A and AAAA record for @ except the one shown below." },
  caa_blocks_ssl: { title: "Your domain blocks our certificate", reason: "A CAA record on your domain only allows another company to issue certificates.", fix: "Add a CAA record: 0 issue \"letsencrypt.org\", or remove the existing CAA record." },
  propagation_slow: { title: "Still spreading", reason: "Your records are right, but some DNS servers haven't caught up yet.", fix: "Nothing to do. We'll keep checking every 30 seconds; it can take up to 24 hours." },
};

/** Recognises the registrar from the name. A backend asks the domain's nameservers instead. */
export function detectProvider(host: string): DnsProviderId {
  const h = host.toLowerCase();
  if (/(^|\.)(cf|cloudflare)|\.dev$|\.app$/.test(h)) return "cloudflare";
  if (/\.(in|co\.in|com)$/.test(h) && !/shop|store/.test(h.split(".")[0])) return "godaddy";
  if (/\.(io|xyz|me)$/.test(h)) return "namecheap";
  if (/\.(online|site|tech)$/.test(h)) return "hostinger";
  if (/\.(page|how|foo)$/.test(h)) return "squarespace";
  return "other";
}

export function normaliseHost(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").replace(/\.$/, "");
}

export function validateHost(host: string): string | undefined {
  if (!host) return "Type the domain you own, like shop.yourname.in.";
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) return "That doesn't look like a domain. Use letters, numbers and dots, like yourname.in.";
  if (host.endsWith(SUBDOMAIN_ROOT)) return `That's already your free address. Add a domain you own instead.`;
  return undefined;
}

function recordsFor(host: string): DnsRecord[] {
  const sub = host.split(".").length > 2;
  return sub
    ? [{ type: "CNAME", name: host.split(".")[0], value: DNS_TARGET.cname }, { type: "TXT", name: `_powerproof.${host.split(".")[0]}`, value: `pp-verify=${host.length.toString(36)}${host.charCodeAt(0).toString(36)}` }]
    : [{ type: "A", name: "@", value: DNS_TARGET.a }, { type: "CNAME", name: "www", value: DNS_TARGET.cname }, { type: "TXT", name: "_powerproof", value: `pp-verify=${host.length.toString(36)}${host.charCodeAt(0).toString(36)}` }];
}

function scopeOf(storeId: string) {
  return ownedScopes().find((s) => s.store.id === storeId) ?? notFound("Store");
}

function domainsOf(storeId: string): StoreDomains {
  const s = scopeOf(storeId);
  s.domains ??= { subdomain: s.store.slug };
  return s.domains;
}

export function getDomains(storeId: string): Promise<StoreDomains> {
  return call(() => domainsOf(storeId), { fast: true });
}

const TAKEN = ["shop", "store", "admin", "help", "www", "api", "mail", "inkwell", "gridgrain"];

export function checkSubdomain(storeId: string, name: string): Promise<{ ok: boolean; message: string }> {
  return call(() => {
    const n = name.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(n)) return { ok: false, message: "Use 3 to 32 letters, numbers or dashes. No dash at the start or end." };
    const mine = domainsOf(storeId).subdomain;
    if (n === mine) return { ok: true, message: "This is your current address." };
    const others = ownedScopes().filter((s) => s.store.id !== storeId).map((s) => s.domains?.subdomain ?? s.store.slug);
    if (TAKEN.includes(n) || others.includes(n)) return { ok: false, message: `${n}.${SUBDOMAIN_ROOT} is taken. Try another.` };
    return { ok: true, message: `${n}.${SUBDOMAIN_ROOT} is available.` };
  }, { fast: true });
}

export function setSubdomain(storeId: string, name: string): Promise<StoreDomains> {
  return call(async () => {
    const r = await checkSubdomain(storeId, name);
    if (!r.ok) throw new ApiError(r.message, "validation");
    commit(() => (domainsOf(storeId).subdomain = name.trim().toLowerCase()));
    return domainsOf(storeId);
  });
}

/** Step 1. Free creators get the Upgrade dialog here, after seeing what the domain needs. */
export function addDomain(storeId: string, input: string): Promise<StoreDomains> {
  return call(() => {
    const host = normaliseHost(input);
    const problem = validateHost(host);
    if (problem) throw new ApiError(problem, "validation");
    if (!PLAN_LIMITS[db().plan.tier ?? "pro"].customDomain) throw new LimitError("customDomain", "Custom domains are part of Pro.");
    const provider = detectProvider(host);
    const d: StoreDomain = {
      host,
      provider,
      auto: DNS_PROVIDERS[provider].auto,
      status: "not_connected",
      records: recordsFor(host),
      primary: true,
      wwwRedirect: "www_to_root",
      redirectSubdomain: true,
      addedAt: new Date().toISOString(),
      pendingChecks: 1,
    };
    commit(() => (domainsOf(storeId).custom = d));
    return domainsOf(storeId);
  });
}

function custom(storeId: string): StoreDomain {
  return domainsOf(storeId).custom ?? notFound("Domain");
}

/** Step 2, one-click: the provider's page adds the records, then we start checking. */
export function connectAutomatically(storeId: string): Promise<StoreDomains> {
  return call(() => {
    const d = custom(storeId);
    if (!d.auto) throw new ApiError(`${DNS_PROVIDERS[d.provider].name} doesn't support automatic setup. Add the records by hand.`, "validation");
    commit(() => {
      d.status = "verifying";
      d.issue = undefined;
      d.pendingChecks = 0;
    });
    return domainsOf(storeId);
  });
}

/** Step 2, manual: the creator says the records are in. */
export function markRecordsAdded(storeId: string): Promise<StoreDomains> {
  return call(() => {
    const d = custom(storeId);
    commit(() => {
      d.status = "waiting_dns";
      d.issue = undefined;
    });
    return domainsOf(storeId);
  });
}

const NEXT: Partial<Record<DomainStatus, DomainStatus>> = { not_connected: "waiting_dns", waiting_dns: "verifying", verifying: "issuing_ssl", issuing_ssl: "connected" };

/** Step 3. Each check moves one step along: DNS found, verified, certificate issued, connected. */
export function verifyDomain(storeId: string): Promise<StoreDomains> {
  return call(() => {
    const d = custom(storeId);
    commit(() => {
      d.checkedAt = new Date().toISOString();
      if (d.status === "connected") return;
      if (d.issue && d.issue !== "propagation_slow") return;
      if (d.status === "waiting_dns" && (d.pendingChecks ?? 0) > 0) {
        d.pendingChecks = (d.pendingChecks ?? 1) - 1;
        return;
      }
      if (d.issue === "propagation_slow") d.issue = undefined;
      const next = NEXT[d.status === "needs_attention" ? "waiting_dns" : d.status];
      if (next) d.status = next;
      if (next === "connected") d.connectedAt = d.checkedAt;
    });
    return domainsOf(storeId);
  });
}

export function updateDomainSettings(storeId: string, patch: Partial<Pick<StoreDomain, "primary" | "wwwRedirect" | "redirectSubdomain">>): Promise<StoreDomains> {
  return call(() => {
    const d = custom(storeId);
    if (d.status !== "connected") throw new ApiError("Finish connecting the domain first.", "conflict");
    commit(() => Object.assign(d, patch));
    return domainsOf(storeId);
  });
}

export function removeDomain(storeId: string): Promise<StoreDomains> {
  return call(() => {
    commit(() => (domainsOf(storeId).custom = undefined));
    return domainsOf(storeId);
  });
}

/** Dev panel on /design: force any status or problem. */
export function simulateDomain(storeId: string, force: { status?: DomainStatus; issue?: DomainIssue | null; host?: string }): Promise<StoreDomains> {
  return call(() => {
    const ds = domainsOf(storeId);
    commit(() => {
      if (!ds.custom) {
        const host = force.host ?? "shop.example.in";
        const provider = detectProvider(host);
        ds.custom = { host, provider, auto: DNS_PROVIDERS[provider].auto, status: "not_connected", records: recordsFor(host), primary: true, wwwRedirect: "www_to_root", redirectSubdomain: true, addedAt: new Date().toISOString() };
      }
      const d = ds.custom;
      if (force.status) d.status = force.status;
      if (force.issue !== undefined) {
        d.issue = force.issue ?? undefined;
        if (force.issue && force.issue !== "propagation_slow") d.status = "needs_attention";
        d.records = recordsFor(d.host).map((r, i) => (i === 0 && force.issue === "wrong_target" ? { ...r, found: "192.0.2.44" } : r));
      }
      if (d.status === "connected") d.connectedAt ??= new Date().toISOString();
      d.pendingChecks = 0;
    });
    return ds;
  }, { fast: true });
}
