import "server-only";
import { createElement } from "react";
import { randomUUID } from "node:crypto";
import { AGENT_CODE } from "@/agents/server";
import { getManifest } from "@/agents/index";
import { siteUrl } from "@/lib/site-url";
import { openSecrets, sealSecrets } from "@/lib/server/integrations";
import { ConnectionBrokenEmail } from "@/emails/agents/agent-emails";
import { agentsAdmin, must, storeDb } from "../db";
import { renderEmail, sendAgentMail } from "../mail";
import { businessName, loadStoreInfo, ownerEmail } from "../ports";
import type { JobResult } from "../runner";
import { googleConfig, sheetRange } from "./google";

/**
 * Google Sheets, with the non-sensitive drive.file scope: the owner picks one sheet in Google's
 * Picker and the app can read only that file. The refresh token is sealed with the app's existing
 * AES-256-GCM helper (lib/server/integrations.ts) and never leaves the server. A connection that
 * stops working pauses only the agents that use it, shows a banner and emails the owner; once it
 * works again they switch back on.
 */

export class GoogleError extends Error {
  constructor(message: string, readonly reauth = false) {
    super(message);
  }
}

async function tokenRequest(body: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), signal: AbortSignal.timeout(10_000) });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
  if (!res.ok || !j.access_token) throw new GoogleError(j.error === "invalid_grant" ? "Google access was removed or expired. Connect the sheet again." : "Google didn't answer. Try again in a minute.", j.error === "invalid_grant");
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_in: j.expires_in ?? 3600, scope: j.scope };
}

/** The Picker's popup code, swapped for tokens; the refresh token is sealed into a new connection */
export async function connectGoogle(storeId: string, code: string, userId: string): Promise<{ connectionId: string; accessToken: string }> {
  const cfg = googleConfig();
  if (!cfg) throw new GoogleError("Google Sheets isn't set up on this site yet.");
  const t = await tokenRequest({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: "postmessage", grant_type: "authorization_code" });
  if (!t.refresh_token) throw new GoogleError("Google didn't give lasting access. Connect again and allow access.");
  if (t.scope && !t.scope.split(" ").includes("https://www.googleapis.com/auth/drive.file")) throw new GoogleError("Allow access to the sheet you pick, then try again.");
  const row = must(
    await agentsAdmin().from("agent_connections").insert({ store_id: storeId, type: "google_sheets", label: "Google Sheet", config: { fileId: null }, secret_enc: sealSecrets({ refreshToken: t.refresh_token }), status: "connected", created_by: userId }).select("id").single(),
    "save connection"
  ) as { id: string };
  return { connectionId: row.id, accessToken: t.access_token };
}

async function connectionRow(id: string) {
  const row = must(await agentsAdmin().from("agent_connections").select("id, store_id, type, config, secret_enc, status").eq("id", id).maybeSingle(), "read connection");
  if (!row) throw new GoogleError("That connection wasn't found.");
  return row as { id: string; store_id: string; type: string; config: Record<string, unknown>; secret_enc: string | null; status: string };
}

export async function accessTokenFor(connectionId: string): Promise<string> {
  const cfg = googleConfig();
  if (!cfg) throw new GoogleError("Google Sheets isn't set up on this site yet.");
  const row = await connectionRow(connectionId);
  const refreshToken = openSecrets(row.secret_enc).refreshToken;
  if (!refreshToken) throw new GoogleError("Connect the sheet again.", true);
  return (await tokenRequest({ refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token" })).access_token;
}

export async function readSheetRows(accessToken: string, fileId: string): Promise<{ title: string; rows: string[][] }> {
  const auth = { authorization: `Bearer ${accessToken}` };
  const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}?fields=properties.title,sheets.properties.title`, { headers: auth, signal: AbortSignal.timeout(10_000) });
  if (meta.status === 401 || meta.status === 403 || meta.status === 404) throw new GoogleError("The app can't open that sheet any more. Pick it again.", true);
  if (!meta.ok) throw new GoogleError("Google Sheets didn't answer. Try again in a minute.");
  const m = (await meta.json()) as { properties?: { title?: string }; sheets?: { properties?: { title?: string } }[] };
  const tab = m.sheets?.[0]?.properties?.title ?? "Sheet1";
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}/values/${encodeURIComponent(sheetRange(tab))}`, { headers: auth, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new GoogleError("Google Sheets didn't answer. Try again in a minute.");
  const j = (await res.json()) as { values?: unknown[][] };
  return { title: m.properties?.title ?? "Google Sheet", rows: (j.values ?? []).map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))) };
}

/** The picked file is saved, then read straight away */
export async function pickSheet(connectionId: string, fileId: string, name: string): Promise<JobResult & { summary?: unknown }> {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) throw new GoogleError("That doesn't look like a Google Sheet.");
  const row = await connectionRow(connectionId);
  await agentsAdmin().from("agent_connections").update({ label: name.slice(0, 120), config: { ...row.config, fileId, name: name.slice(0, 200) }, updated_at: new Date().toISOString() }).eq("id", connectionId);
  return refreshSheet(connectionId);
}

/** Reads the sheet and hands the rows to every agent linked to it (the daily refresh and "Refresh now") */
export async function refreshSheet(connectionId: string): Promise<JobResult & { summary?: unknown }> {
  const sb = agentsAdmin();
  const row = await connectionRow(connectionId);
  const fileId = typeof row.config.fileId === "string" ? row.config.fileId : null;
  if (!fileId) return { ok: true, note: "no sheet picked yet" };
  try {
    const token = await accessTokenFor(connectionId);
    const { title, rows } = await readSheetRows(token, fileId);
    const links = must(await sb.from("agent_instance_connections").select("instance_id").eq("connection_id", connectionId), "read links") as { instance_id: string }[];
    const instances = links.length ? ((must(await sb.from("agent_instances").select("id, agent_id").in("id", links.map((l) => l.instance_id)), "read agents") ?? []) as { id: string; agent_id: string }[]) : [];
    let summary: unknown = null;
    for (const inst of instances) {
      const hook = AGENT_CODE[inst.agent_id]?.ingest;
      if (!hook) continue;
      const r = await hook(storeDb(row.store_id), rows, { source: "sheet", fileName: title, mapping: row.config.mapping as Record<string, number> | undefined, isFull: true, now: new Date(), newId: randomUUID });
      if (!r.ok) throw new GoogleError(r.message ?? "The sheet couldn't be read.");
      summary = r.summary;
    }
    await markHealthy(row.id, row.store_id, row.status !== "connected");
    return { ok: true, summary };
  } catch (e) {
    const g = e instanceof GoogleError ? e : new GoogleError("The sheet couldn't be read.");
    await markBroken(row.id, row.store_id, g.reauth ? "needs_reauth" : "error", g.message);
    // A reauth problem won't fix itself: no retry; anything else is retried by the job
    return g.reauth ? { ok: true, note: g.message } : { ok: false, error: g.message, retryInSeconds: 3600 };
  }
}

async function markHealthy(connectionId: string, storeId: string, wasBroken: boolean) {
  const sb = agentsAdmin();
  const now = new Date().toISOString();
  await sb.from("agent_connections").update({ status: "connected", last_error: null, last_checked_at: now, updated_at: now }).eq("id", connectionId);
  if (!wasBroken) return;
  const links = (must(await sb.from("agent_instance_connections").select("instance_id").eq("connection_id", connectionId), "read links") ?? []) as { instance_id: string }[];
  for (const l of links) {
    const { data: sub } = await sb.from("agent_instances").select("agent_id").eq("id", l.instance_id).maybeSingle();
    const { data: paid } = await sb.from("agent_subscriptions").select("status").eq("store_id", storeId).eq("agent_id", sub?.agent_id ?? "").maybeSingle();
    await sb.from("agent_instances").update({ status: paid?.status === "active" ? "active" : "trial", paused_reason: null, next_run_at: now, updated_at: now }).eq("id", l.instance_id).eq("status", "paused").eq("paused_reason", "connection");
  }
}

/** Pauses only the agents that use this connection, and tells the owner once */
export async function markBroken(connectionId: string, storeId: string, status: "needs_reauth" | "error", problem: string) {
  const sb = agentsAdmin();
  const now = new Date().toISOString();
  const { data: before } = await sb.from("agent_connections").select("status, label").eq("id", connectionId).maybeSingle();
  await sb.from("agent_connections").update({ status, last_error: problem.slice(0, 300), last_checked_at: now, updated_at: now }).eq("id", connectionId);
  const links = (must(await sb.from("agent_instance_connections").select("instance_id").eq("connection_id", connectionId), "read links") ?? []) as { instance_id: string }[];
  const paused = links.length ? ((await sb.from("agent_instances").update({ status: "paused", paused_reason: "connection", updated_at: now }).in("id", links.map((l) => l.instance_id)).in("status", ["trial", "active"]).select("agent_id")).data ?? []) : [];
  if (before?.status !== "connected") return;
  const store = await loadStoreInfo(storeId);
  const to = await ownerEmail(store.owner_id);
  if (!to) return;
  const { html, text } = await renderEmail(
    createElement(ConnectionBrokenEmail, {
      storeName: businessName(store),
      connection: String(before?.label || "Your Google Sheet"),
      agents: paused.length ? paused.map((p) => getManifest(String(p.agent_id))?.name ?? String(p.agent_id)) : ["none"],
      problem,
      fixUrl: `${siteUrl()}/agents/my/connections`,
    })
  );
  await sendAgentMail({ displayName: "PowerProof Agents", to, subject: `${before?.label || "Your Google Sheet"} needs you`, html, text });
}
