import "server-only";
import { sbAdmin } from "../supabase/admin";
import { sbServer } from "../supabase/server";
import { normaliseHost, validateHost } from "../api/domains";
import { addProjectDomain, DomainApiError, getDomainConfig, getProjectDomain, issueFrom, recordsFor, removeProjectDomain, vercelConfig, verifyProjectDomain, type DnsRecord, type VercelConfig, type Verification } from "./vercel";

export interface DomainRow {
  host: string;
  status: "pending" | "verifying" | "active" | "failed";
  records: DnsRecord[];
  issue: string | null;
  checkedAt: string | null;
}

export class DomainError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type Row = { hostname: string; status: DomainRow["status"]; error: string | null; last_checked_at: string | null };
const COLS = "hostname, status, error, last_checked_at";
const toRow = (r: Row, verification?: Verification[]): DomainRow => ({ host: String(r.hostname), status: r.status, records: recordsFor(String(r.hostname), verification), issue: r.error, checkedAt: r.last_checked_at });

/**
 * The signed-in person must own the store. The Pro-plan rule is the database's own trigger on
 * `domains`; it is checked here too, so people get a clear answer before anything is attached.
 */
async function allowed(storeId: string, needHost = true): Promise<VercelConfig | null> {
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new DomainError("Log in again to change your domain.", 401);
  const { data: store } = await db.from("stores").select("id, owner_id").eq("id", storeId).maybeSingle();
  if (!store || store.owner_id !== auth.user.id) throw new DomainError("We can't find that store.", 404);
  const admin = sbAdmin();
  const { data: profile } = await admin.from("profiles").select("plan").eq("id", auth.user.id).single();
  const { data: limits } = await admin.from("plan_limits").select("custom_domain").eq("plan", profile?.plan ?? "free").single();
  if (!limits?.custom_domain) throw new DomainError("Your own domain is part of the Pro plan.", 402);
  const cfg = vercelConfig();
  if (!cfg && needHost) throw new DomainError("Custom domains aren't connected on this deployment yet.", 503);
  return cfg;
}

/** The store's domain, with the records to add (including the host's ownership proof while it's pending) */
export async function getDomain(storeId: string): Promise<{ domain: DomainRow | null; connected: boolean }> {
  const cfg = await allowed(storeId, false);
  const { data: d } = await sbAdmin().from("domains").select(COLS).eq("store_id", storeId).maybeSingle();
  if (!d) return { domain: null, connected: !!cfg };
  let verification: Verification[] | undefined;
  if (cfg && d.status !== "active") verification = (await getProjectDomain(cfg, String(d.hostname)).catch(() => undefined))?.verification;
  return { domain: toRow(d as Row, verification), connected: !!cfg };
}

/** Attaches the domain to the site and saves the records the owner must add at their DNS host */
export async function addDomain(storeId: string, input: string): Promise<DomainRow> {
  const cfg = (await allowed(storeId))!;
  const host = normaliseHost(input);
  const bad = validateHost(host);
  if (bad) throw new DomainError(bad);
  const admin = sbAdmin();
  const { data: taken } = await admin.from("domains").select("store_id").eq("hostname", host).maybeSingle();
  if (taken && taken.store_id !== storeId) throw new DomainError("That domain is already connected to another store.", 409);
  const { data: mine } = await admin.from("domains").select("hostname").eq("store_id", storeId).maybeSingle();
  if (mine && String(mine.hostname) !== host) throw new DomainError("A store has one domain. Remove the current one first.", 409);
  try {
    const pd = await addProjectDomain(cfg, host).catch((e) => {
      // Already attached to this project (a retry): read it instead
      if (e instanceof DomainApiError && e.status === 409) return getProjectDomain(cfg, host);
      throw e;
    });
    const saved = await admin.from("domains").upsert({ store_id: storeId, hostname: host, status: "pending", error: null, last_checked_at: null }, { onConflict: "store_id" }).select(COLS).single();
    if (saved.error) throw new DomainError(saved.error.message.includes("Pro plan") ? "Your own domain is part of the Pro plan." : "We couldn't save that domain. Try again.", saved.error.message.includes("Pro plan") ? 402 : 500);
    return toRow(saved.data as Row, pd.verification);
  } catch (e) {
    if (e instanceof DomainApiError) throw new DomainError(e.message, e.status === 409 ? 409 : 502);
    throw e;
  }
}

/** Asks the host whether the records are in place; the domain goes live once they are */
export async function checkDomain(storeId: string): Promise<DomainRow> {
  const cfg = (await allowed(storeId))!;
  const admin = sbAdmin();
  const { data: d } = await admin.from("domains").select("hostname").eq("store_id", storeId).maybeSingle();
  if (!d) throw new DomainError("Add a domain first.", 404);
  const host = String(d.hostname);
  try {
    let pd = await getProjectDomain(cfg, host);
    if (!pd.verified) pd = await verifyProjectDomain(cfg, host).catch(() => pd);
    const conf = await getDomainConfig(cfg, host).catch(() => undefined);
    const issue = issueFrom({ verified: pd.verified, misconfigured: conf?.misconfigured, aValues: conf?.aValues, cnames: conf?.cnames }, host);
    const now = new Date().toISOString();
    const saved = await admin.from("domains").update({ status: issue === null ? "active" : "pending", error: issue, last_checked_at: now, ...(issue === null ? { verified_at: now } : {}) }).eq("store_id", storeId).select(COLS).single();
    if (saved.error) throw new DomainError("We couldn't save the result. Try again.", 500);
    return toRow(saved.data as Row, pd.verification);
  } catch (e) {
    if (e instanceof DomainApiError) throw new DomainError(e.message, 502);
    throw e;
  }
}

export async function removeDomain(storeId: string): Promise<void> {
  const cfg = (await allowed(storeId))!;
  const admin = sbAdmin();
  const { data: d } = await admin.from("domains").select("hostname").eq("store_id", storeId).maybeSingle();
  if (!d) return;
  await removeProjectDomain(cfg, String(d.hostname)).catch((e) => {
    if (!(e instanceof DomainApiError)) throw e;
    console.error("[domains] couldn't detach", d.hostname, e.message);
  });
  await admin.from("domains").delete().eq("store_id", storeId);
}
