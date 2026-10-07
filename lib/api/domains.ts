import type { DnsProviderId, DomainIssue } from "../types";

/**
 * Custom domain helpers: provider guides, DNS targets, problem explanations and hostname checks.
 * Connecting a domain needs DNS and certificate checks on the server, so the screen says
 * "coming soon" until that exists; nothing here pretends a domain is connected.
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
