import "server-only";
import { sbAdmin } from "../supabase/admin";
import { sbServer } from "../supabase/server";
import { normaliseHost, validateHost } from "../api/domains";
import { cloudflareConfig, deleteHostname, DomainApiError, ensureHostname, findHostname, isLive, issueFrom, lookupDns, recordsFor, refreshHostname, wwwOf, type CloudflareConfig, type CustomHostname, type DnsRecord } from "./cloudflare";

export interface DomainRow {
  host: string;
  status: "pending" | "verifying" | "active" | "failed";
  records: DnsRecord[];
  issue: string | null;
  checkedAt: string | null;
  /** The free address sends visitors here once it's live */
  primary: boolean;
  /** For a bare domain: www.<domain> is connected too and sends visitors to it */
  www: string | null;
}

export class DomainError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type Row = { hostname: string; status: DomainRow["status"]; error: string | null; last_checked_at: string | null; is_primary: boolean; www_mode: string };
const COLS = "hostname, status, error, last_checked_at, is_primary, www_mode";
const toRow = (r: Row, cfg: CloudflareConfig | null, hostname?: CustomHostname | null): DomainRow => {
  const host = String(r.hostname);
  const www = r.www_mode === "www_to_apex" ? wwwOf(host) : null;
  return { host, status: r.status, records: cfg ? recordsFor(host, cfg, hostname, !!www) : [], issue: r.error, checkedAt: r.last_checked_at, primary: r.is_primary, www };
};

/**
 * The signed-in person must be able to work on the store's design (the owner, an admin, or a team
 * member with that area; the database's store_can decides). The Pro-plan rule is the database's
 * own trigger on `domains` and follows the store owner's plan; it is checked here too, so people
 * get a clear answer before anything is attached.
 */
async function allowed(storeId: string, needHost = true): Promise<CloudflareConfig | null> {
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new DomainError("Log in again to change your domain.", 401);
  const { data: ok } = await db.rpc("store_can", { p_store: storeId, p_area: "design" });
  if (ok !== true) throw new DomainError("We can't find that store, or your team access doesn't include its domain.", 404);
  const admin = sbAdmin();
  const { data: store } = await admin.from("stores").select("owner_id").eq("id", storeId).single();
  const { data: profile } = await admin.from("profiles").select("plan").eq("id", store?.owner_id ?? "").maybeSingle();
  const { data: limits } = await admin.from("plan_limits").select("custom_domain").eq("plan", profile?.plan ?? "free").single();
  if (!limits?.custom_domain) throw new DomainError("Your own domain is part of the Pro plan.", 402);
  const cfg = cloudflareConfig();
  if (!cfg && needHost) throw new DomainError("Custom domains aren't connected on this deployment yet.", 503);
  return cfg;
}

/** The store's domain, with the records to add (including Cloudflare's ownership check while it's pending) */
export async function getDomain(storeId: string): Promise<{ domain: DomainRow | null; connected: boolean }> {
  const cfg = await allowed(storeId, false);
  const { data: d } = await sbAdmin().from("domains").select(COLS).eq("store_id", storeId).maybeSingle();
  if (!d) return { domain: null, connected: !!cfg };
  const hostname = cfg && d.status !== "active" ? await findHostname(cfg, String(d.hostname)).catch(() => null) : null;
  return { domain: toRow(d as Row, cfg, hostname), connected: !!cfg };
}

/**
 * Adds the domain to Cloudflare and saves the records the owner must add at their DNS host. A bare
 * domain also gets www (the app sends www visitors on to the bare domain), so both addresses work.
 */
export async function addDomain(storeId: string, input: string): Promise<DomainRow> {
  const cfg = (await allowed(storeId))!;
  const host = normaliseHost(input);
  const bad = validateHost(host);
  if (bad) throw new DomainError(bad);
  if (host === cfg.target || host.endsWith(`.${cfg.target}`)) throw new DomainError("That's PowerProof's own address. Add a domain you own instead.");
  const admin = sbAdmin();
  const { data: taken } = await admin.from("domains").select("store_id").eq("hostname", host).maybeSingle();
  if (taken && taken.store_id !== storeId) throw new DomainError("That domain is already connected to another store.", 409);
  const { data: mine } = await admin.from("domains").select("hostname").eq("store_id", storeId).maybeSingle();
  if (mine && String(mine.hostname) !== host) throw new DomainError("A store has one domain. Remove the current one first.", 409);
  const www = wwwOf(host);
  try {
    const hostname = await ensureHostname(cfg, host);
    // www is a convenience: if it can't be added (it's used elsewhere), the bare domain still works
    let wwwOk = false;
    if (www) {
      wwwOk = await ensureHostname(cfg, www).then(
        () => true,
        (e) => {
          console.error("[domains] couldn't add", www, e instanceof Error ? e.message : e);
          return false;
        }
      );
    }
    const saved = await admin
      .from("domains")
      .upsert({ store_id: storeId, hostname: host, status: "pending", error: null, last_checked_at: null, www_mode: wwwOk ? "www_to_apex" : "none" }, { onConflict: "store_id" })
      .select(COLS)
      .single();
    if (saved.error) throw new DomainError(saved.error.message.includes("Pro plan") ? "Your own domain is part of the Pro plan." : "We couldn't save that domain. Try again.", saved.error.message.includes("Pro plan") ? 402 : 500);
    return toRow(saved.data as Row, cfg, hostname);
  } catch (e) {
    if (e instanceof DomainApiError) throw new DomainError(e.message, e.status === 409 ? 409 : 502);
    throw e;
  }
}

/**
 * Asks Cloudflare (and public DNS) whether the domain is pointed here and its certificate issued,
 * and saves the answer. A pending domain goes live once it is. A live domain stays live (a passing
 * DNS hiccup shouldn't take a store offline); the problem is recorded and shown so it can be fixed.
 */
async function recheck(cfg: CloudflareConfig, storeId: string, host: string, wasActive: boolean, wwwMode: string): Promise<DomainRow> {
  let hostname = await ensureHostname(cfg, host);
  // A certificate check that gave up is started again
  if (!isLive(hostname) && /timed_out|expired|inactive/.test(hostname.ssl?.status ?? "")) hostname = await refreshHostname(cfg, hostname.id).catch(() => hostname);
  const www = wwwMode === "www_to_apex" ? wwwOf(host) : null;
  if (www) await ensureHostname(cfg, www).catch(() => undefined);
  const dns = await lookupDns(host).catch(() => ({ cnames: [], a: [] }));
  const issue = issueFrom(hostname, dns, host, cfg);
  const now = new Date().toISOString();
  const status = issue === null || wasActive ? "active" : "pending";
  const saved = await sbAdmin()
    .from("domains")
    .update({ status, error: issue, last_checked_at: now, ...(issue === null && !wasActive ? { verified_at: now } : {}) })
    .eq("store_id", storeId)
    .select(COLS)
    .single();
  if (saved.error) throw new DomainError("We couldn't save the result. Try again.", 500);
  return toRow(saved.data as Row, cfg, hostname);
}

/** Asks whether the records are in place; the domain goes live once they are */
export async function checkDomain(storeId: string): Promise<DomainRow> {
  const cfg = (await allowed(storeId))!;
  const { data: d } = await sbAdmin().from("domains").select("hostname, status, www_mode").eq("store_id", storeId).maybeSingle();
  if (!d) throw new DomainError("Add a domain first.", 404);
  try {
    return await recheck(cfg, storeId, String(d.hostname), d.status === "active", d.www_mode);
  } catch (e) {
    if (e instanceof DomainApiError) throw new DomainError(e.message, 502);
    throw e;
  }
}

/** Whether the store's free address sends visitors to this domain */
export async function setPrimary(storeId: string, primary: boolean): Promise<DomainRow> {
  const cfg = await allowed(storeId, false);
  const saved = await sbAdmin().from("domains").update({ is_primary: primary }).eq("store_id", storeId).select(COLS).maybeSingle();
  if (saved.error) throw new DomainError("We couldn't save that. Try again.", 500);
  if (!saved.data) throw new DomainError("Add a domain first.", 404);
  return toRow(saved.data as Row, cfg);
}

export async function removeDomain(storeId: string): Promise<void> {
  const cfg = (await allowed(storeId))!;
  const admin = sbAdmin();
  const { data: d } = await admin.from("domains").select("hostname, www_mode").eq("store_id", storeId).maybeSingle();
  if (!d) return;
  const host = String(d.hostname);
  const names = [...(d.www_mode === "www_to_apex" && wwwOf(host) ? [wwwOf(host)!] : []), host];
  for (const name of names) {
    try {
      const h = await findHostname(cfg, name);
      if (h) await deleteHostname(cfg, h.id);
    } catch (e) {
      if (!(e instanceof DomainApiError)) throw e;
      console.error("[domains] couldn't remove", name, e.message);
    }
  }
  await admin.from("domains").delete().eq("store_id", storeId);
}

/**
 * The scheduled check (the Worker's cron, worker.ts → /api/cron/domains): domains waiting for DNS
 * are looked at every run, and live (or given-up) ones every six hours, so a domain goes live by
 * itself even if nobody keeps the page open.
 */
export async function checkAllDomains(limit = 40): Promise<{ checked: number; live: number; failed: number }> {
  const cfg = cloudflareConfig();
  if (!cfg) return { checked: 0, live: 0, failed: 0 };
  const admin = sbAdmin();
  const stale = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data: rows } = await admin
    .from("domains")
    .select("store_id, hostname, status, www_mode, last_checked_at, created_at")
    // Waiting ones every run; live and given-up ones every six hours
    .or(`status.in.(pending,verifying),last_checked_at.is.null,last_checked_at.lt.${stale}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  let live = 0;
  let failed = 0;
  const weekAgo = Date.now() - 7 * 86400_000;
  for (const r of rows ?? []) {
    try {
      const out = await recheck(cfg, r.store_id, String(r.hostname), r.status === "active", r.www_mode);
      if (out.status === "active" && r.status !== "active") live++;
      // A domain whose records never showed up in a week is marked failed (the owner can retry)
      if (out.status !== "active" && new Date(r.created_at).getTime() < weekAgo) {
        await admin.from("domains").update({ status: "failed" }).eq("store_id", r.store_id);
      }
    } catch (e) {
      failed++;
      console.error("[domains] scheduled check failed for", r.hostname, e instanceof Error ? e.message : e);
    }
  }
  return { checked: rows?.length ?? 0, live, failed };
}
