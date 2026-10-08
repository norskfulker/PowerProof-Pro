import type { DomainIssue } from "../types";

/**
 * Custom domains, attached to this deployment through Vercel's API. Needs VERCEL_API_TOKEN and
 * VERCEL_PROJECT_ID (and VERCEL_TEAM_ID for a team project). Without them nothing is attached and
 * the screen says domains aren't connected on this deployment.
 */
export interface VercelConfig {
  token: string;
  projectId: string;
  teamId?: string;
}

export function vercelConfig(env: Record<string, string | undefined> = process.env): VercelConfig | null {
  return env.VERCEL_API_TOKEN && env.VERCEL_PROJECT_ID ? { token: env.VERCEL_API_TOKEN, projectId: env.VERCEL_PROJECT_ID, teamId: env.VERCEL_TEAM_ID || undefined } : null;
}

export class DomainApiError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

async function call<T>(cfg: VercelConfig, method: string, path: string, body?: unknown): Promise<T> {
  const url = new URL(`https://api.vercel.com${path}`);
  if (cfg.teamId) url.searchParams.set("teamId", cfg.teamId);
  const res = await fetch(url, { method, headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!res.ok) {
    console.error(`[vercel] ${method} ${path} answered ${res.status}: ${json.error?.code ?? ""} ${json.error?.message ?? ""}`);
    if (json.error?.code === "domain_already_in_use" || json.error?.code === "domain_taken") throw new DomainApiError("That domain is already connected to another site.", 409);
    if (json.error?.code === "forbidden" || res.status === 401 || res.status === 403) throw new DomainApiError("The hosting connection isn't allowed to do that. Check the token's access.", 502);
    throw new DomainApiError(json.error?.message ?? "The hosting provider didn't accept that.", res.status >= 500 ? 502 : 400);
  }
  return json;
}

export interface Verification {
  type: string;
  domain: string;
  value: string;
}
export interface ProjectDomain {
  name: string;
  verified: boolean;
  verification?: Verification[];
}

export const addProjectDomain = (cfg: VercelConfig, host: string) => call<ProjectDomain>(cfg, "POST", `/v10/projects/${encodeURIComponent(cfg.projectId)}/domains`, { name: host });
export const getProjectDomain = (cfg: VercelConfig, host: string) => call<ProjectDomain>(cfg, "GET", `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(host)}`);
export const verifyProjectDomain = (cfg: VercelConfig, host: string) => call<ProjectDomain>(cfg, "POST", `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(host)}/verify`);
export const removeProjectDomain = (cfg: VercelConfig, host: string) => call<unknown>(cfg, "DELETE", `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(host)}`);
/** Whether the domain's DNS points at Vercel */
export const getDomainConfig = (cfg: VercelConfig, host: string) => call<{ misconfigured: boolean; aValues?: string[]; cnames?: string[] }>(cfg, "GET", `/v6/domains/${encodeURIComponent(host)}/config`);

/* Pure parts -------------------------------------------------------- */

export const APEX_TARGET = "76.76.21.21";
export const CNAME_TARGET = "cname.vercel-dns.com";

/** Second-level suffixes where the "apex" has three labels, like shop.co.in */
const SECOND_LEVEL = new Set(["co.in", "org.in", "net.in", "gov.in", "ac.in", "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "org.au", "co.nz", "co.za", "com.br", "com.sg", "com.my", "co.jp", "com.ae"]);

export const isApex = (host: string) => {
  const parts = host.split(".");
  return parts.length === 2 || (parts.length === 3 && SECOND_LEVEL.has(parts.slice(1).join(".")));
};

export interface DnsRecord {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
}

/** The records the owner must add: where to point the name, plus any ownership proof the host asks for */
export function recordsFor(host: string, verification: Verification[] = []): DnsRecord[] {
  const point: DnsRecord = isApex(host) ? { type: "A", name: "@", value: APEX_TARGET } : { type: "CNAME", name: host.split(".")[0], value: CNAME_TARGET };
  const proof = verification.filter((v) => v.type.toUpperCase() === "TXT").map((v): DnsRecord => ({ type: "TXT", name: v.domain.replace(new RegExp(`\\.?${host.replace(/\./g, "\\.")}$`), "") || "@", value: v.value }));
  return [point, ...proof];
}

/** Turns what the host reported into the problem the screen explains */
export function issueFrom(state: { verified: boolean; misconfigured?: boolean; aValues?: string[]; cnames?: string[] }, host: string): DomainIssue | null {
  if (state.verified && state.misconfigured === false) return null;
  if (!state.verified && state.misconfigured !== false && !(state.aValues?.length || state.cnames?.length)) return "missing_record";
  if (state.misconfigured) {
    const pointsElsewhere = isApex(host) ? (state.aValues ?? []).some((a) => a !== APEX_TARGET) : (state.cnames ?? []).some((c) => !c.endsWith("vercel-dns.com"));
    return pointsElsewhere ? "wrong_target" : "propagation_slow";
  }
  return "propagation_slow";
}
