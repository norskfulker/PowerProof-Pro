/** Custom domain vocabulary shared by the helpers in lib/api/domains.ts. */
export type DomainStatus = "not_connected" | "waiting_dns" | "verifying" | "issuing_ssl" | "connected" | "needs_attention";

export type DomainIssue = "wrong_target" | "missing_record" | "conflicting_record" | "caa_blocks_ssl" | "propagation_slow";

export type DnsProviderId = "godaddy" | "namecheap" | "cloudflare" | "hostinger" | "squarespace" | "other";

export interface DnsRecord {
  type: "A" | "CNAME" | "TXT";
  /** "@" for the root, or a subdomain like "www" */
  name: string;
  value: string;
  /** What we found when we last checked, when it's wrong */
  found?: string;
}
