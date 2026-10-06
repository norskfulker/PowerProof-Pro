/** Custom domains (Part 7B). */
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

export interface StoreDomain {
  host: string;
  provider: DnsProviderId;
  /** The provider supports one-click setup */
  auto: boolean;
  status: DomainStatus;
  issue?: DomainIssue;
  records: DnsRecord[];
  /** Buyers land here; the other addresses redirect to it */
  primary: boolean;
  wwwRedirect: "www_to_root" | "root_to_www";
  /** yourname.powerproof.store sends buyers to this domain */
  redirectSubdomain: boolean;
  addedAt: string;
  checkedAt?: string;
  connectedAt?: string;
  /** Mock only: how many more checks before DNS is "found" */
  pendingChecks?: number;
}

export interface StoreDomains {
  /** yourname, for yourname.powerproof.store */
  subdomain: string;
  custom?: StoreDomain;
}
