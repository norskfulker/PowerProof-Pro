import { createBrowserClient } from "@supabase/ssr";
import { AGENTS, getManifest } from "../../../agents/index";
import type { AgentsDatabase } from "../../agents-database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../supabase/env";
import type {
  ActionItem,
  AgentConnection,
  AgentInstance,
  AgentListing,
  AgentRun,
  ChaserCustomer,
  ChaserImport,
  ChaserInvoice,
  ChaserReminder,
  CreditEntry,
} from "../../types/agents";
import { ApiError } from "../client";
import { notifyChange } from "./local";
import { activeStoreId } from "./session";

/**
 * Agents: reads through the browser's Supabase session (RLS: store_can(store, 'agents')), writes
 * through the server routes in app/api/agents (they check access, then write with the server key).
 */

type Row = Record<string, unknown>;

// @supabase/ssr hands back one browser client per page, so this shares the app's session
const sb = () => createBrowserClient<AgentsDatabase>(SUPABASE_URL, SUPABASE_ANON_KEY);

function rows<T>(r: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (r.error) throw new ApiError(`We couldn't load ${what}. Refresh to try again.`);
  return (r.data ?? []) as T[];
}

export async function post<T = Record<string, unknown>>(url: string, body: unknown, method = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("You're offline, or we couldn't reach PowerProof. Try again.");
  }
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (!res.ok || j.ok === false) throw new ApiError(j.message ?? "Something went wrong. Try again.", res.status === 404 ? "not_found" : res.status === 409 ? "conflict" : "validation");
  if (method !== "GET") notifyChange();
  return j;
}

export const currentStoreId = () => activeStoreId();

/* Catalog -------------------------------------------------------------------------------------- */

export async function getCatalog(): Promise<AgentListing[]> {
  const [cat, plans] = await Promise.all([sb().from("agent_catalog").select("id, name, tagline, description, category, status, enabled, sort").order("sort"), sb().from("agent_plans").select("agent_id, price_minor, launch_price_minor, included_credits, active")]);
  const planRows = rows<Row>(plans, "prices");
  return rows<Row>(cat, "agents")
    .filter((r) => r.status === "live" || r.status === "coming_soon")
    .map((r): AgentListing => {
      const m = getManifest(String(r.id));
      const live = r.status === "live" && !!m;
      const p = planRows.find((x) => x.agent_id === r.id && x.active);
      return {
        id: String(r.id),
        // A live agent's words come from its manifest; coming-soon ones from the catalog row
        name: live ? m!.name : String(r.name),
        tagline: live ? m!.tagline : String(r.tagline),
        description: live ? m!.description : String(r.description),
        category: live ? m!.category : String(r.category),
        status: live ? "live" : "coming_soon",
        enabled: r.enabled !== false,
        manifest: live ? m! : null,
        plan: p ? { priceMinor: Number(p.price_minor), launchPriceMinor: p.launch_price_minor === null ? null : Number(p.launch_price_minor), includedCredits: Number(p.included_credits) } : null,
      };
    });
}

export const liveAgentIds = () => AGENTS.map((a) => a.id);

/* Instances ------------------------------------------------------------------------------------ */

const INSTANCE = "id, store_id, agent_id, status, settings, consent_at, paused_reason, last_run_at, next_run_at, created_at";
const instanceFrom = (r: Row): AgentInstance => ({
  id: String(r.id),
  storeId: String(r.store_id),
  agentId: String(r.agent_id),
  status: r.status as AgentInstance["status"],
  settings: (r.settings as Record<string, unknown>) ?? {},
  consentAt: (r.consent_at as string | null) ?? null,
  pausedReason: (r.paused_reason as string | null) ?? null,
  lastRunAt: (r.last_run_at as string | null) ?? null,
  nextRunAt: (r.next_run_at as string | null) ?? null,
  createdAt: String(r.created_at),
});

export async function getMyAgents(): Promise<AgentInstance[]> {
  const storeId = await activeStoreId();
  return rows<Row>(await sb().from("agent_instances").select(INSTANCE).eq("store_id", storeId).order("created_at"), "your agents").map(instanceFrom);
}

export async function getInstance(id: string): Promise<AgentInstance> {
  const r = await sb().from("agent_instances").select(INSTANCE).eq("id", id).maybeSingle();
  if (r.error) throw new ApiError("We couldn't load this agent. Refresh to try again.");
  if (!r.data) throw new ApiError("That agent wasn't found.", "not_found");
  return instanceFrom(r.data as Row);
}

export async function startAgent(agentId: string): Promise<string> {
  const storeId = await activeStoreId();
  return (await post<{ instanceId: string }>("/api/agents/instances", { storeId, agentId })).instanceId;
}

export const saveAgentSettings = (id: string, settings: Record<string, unknown>) => post<{ settings: Record<string, unknown> }>(`/api/agents/instances/${id}`, { settings }, "PATCH");
export const agentOp = <T = Record<string, unknown>>(id: string, body: Record<string, unknown>) => post<T>(`/api/agents/instances/${id}`, body);

export async function getMetrics(id: string): Promise<Record<string, number>> {
  const res = await fetch(`/api/agents/instances/${id}`, { cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; metrics?: Record<string, number>; message?: string };
  if (!res.ok || !j.ok) throw new ApiError(j.message ?? "We couldn't load the numbers.");
  return j.metrics ?? {};
}

export async function getRuns(instanceId: string, limit = 30): Promise<AgentRun[]> {
  return rows<Row>(await sb().from("agent_runs").select("id, trigger, dry_run, status, summary, error, started_at, finished_at").eq("instance_id", instanceId).order("started_at", { ascending: false }).limit(limit), "activity").map((r) => ({
    id: String(r.id),
    trigger: r.trigger as AgentRun["trigger"],
    dryRun: Boolean(r.dry_run),
    status: r.status as AgentRun["status"],
    summary: (r.summary as Record<string, unknown>) ?? {},
    error: (r.error as string | null) ?? null,
    startedAt: String(r.started_at),
    finishedAt: (r.finished_at as string | null) ?? null,
  }));
}

/* Action queue --------------------------------------------------------------------------------- */

export async function getActionItems(o: { instanceId?: string } = {}): Promise<ActionItem[]> {
  const storeId = await activeStoreId();
  let q = sb().from("agent_action_items").select("id, instance_id, kind, status, title, body, payload, ref_type, ref_id, created_at, snooze_until").eq("store_id", storeId).in("status", ["open", "snoozed"]).order("created_at").limit(500);
  if (o.instanceId) q = q.eq("instance_id", o.instanceId);
  const now = Date.now();
  return rows<Row>(await q, "the queue")
    .map(
      (r): ActionItem => ({
        id: String(r.id),
        instanceId: String(r.instance_id),
        kind: r.kind as ActionItem["kind"],
        status: r.status as ActionItem["status"],
        title: String(r.title),
        body: (r.body as string | null) ?? null,
        payload: (r.payload as Record<string, unknown>) ?? {},
        refType: (r.ref_type as string | null) ?? null,
        refId: (r.ref_id as string | null) ?? null,
        createdAt: String(r.created_at),
        snoozeUntil: (r.snooze_until as string | null) ?? null,
      })
    )
    .filter((a) => a.status === "open" || (a.snoozeUntil !== null && Date.parse(a.snoozeUntil) <= now));
}

export const actOn = (id: string, action: "done" | "skip" | "snooze", hours?: number) => post(`/api/agents/actions/${id}`, { action, hours });

/* Connections and credits ---------------------------------------------------------------------- */

export async function getConnections(): Promise<AgentConnection[]> {
  const storeId = await activeStoreId();
  const [c, links] = await Promise.all([
    sb().from("agent_connections").select("id, type, label, config, status, last_checked_at, last_error, created_at").eq("store_id", storeId).order("created_at"),
    sb().from("agent_instance_connections").select("instance_id, connection_id").eq("store_id", storeId),
  ]);
  const l = rows<Row>(links, "connections");
  return rows<Row>(c, "connections").map((r) => ({
    id: String(r.id),
    type: r.type as AgentConnection["type"],
    label: String(r.label ?? ""),
    config: (r.config as Record<string, unknown>) ?? {},
    status: r.status as AgentConnection["status"],
    lastCheckedAt: (r.last_checked_at as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    createdAt: String(r.created_at),
    usedBy: l.filter((x) => x.connection_id === r.id).map((x) => String(x.instance_id)),
  }));
}

export const connectionOp = <T = Record<string, unknown>>(body: Record<string, unknown>) => post<T>("/api/agents/connections", body);

export async function googleSettings(): Promise<{ clientId: string; apiKey: string | null; appId: string | null } | null> {
  const res = await fetch("/api/agents/connections", { cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as { google?: { clientId: string; apiKey: string | null; appId: string | null } | null };
  return j.google ?? null;
}

export async function getCredits(): Promise<{ balance: number; entries: CreditEntry[] }> {
  const storeId = await activeStoreId();
  const [b, e] = await Promise.all([
    sb().from("agent_credit_balances").select("balance").eq("store_id", storeId).maybeSingle(),
    sb().from("agent_credit_ledger").select("delta, kind, reason, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (b.error) throw new ApiError("We couldn't load your credits.");
  return { balance: Number((b.data as Row | null)?.balance ?? 0), entries: rows<Row>(e, "credits").map((r) => ({ delta: Number(r.delta), kind: String(r.kind), reason: (r.reason as string | null) ?? null, createdAt: String(r.created_at) })) };
}

/** Buying credits: an order to pay in Razorpay's window, then the signature it hands back */
export async function startCreditPurchase(credits: number): Promise<{ keyId: string; orderId: string; amountMinor: number; currency: string }> {
  return post("/api/agents/credits", { op: "start", storeId: await activeStoreId(), credits });
}
export async function confirmCreditPurchase(r: { orderId: string; paymentId: string; signature: string }): Promise<{ credits: number }> {
  return post("/api/agents/credits", { op: "confirm", storeId: await activeStoreId(), ...r });
}

export const requestAgent = (input: { agentId: string; email: string; mobile?: string; note?: string; storeId?: string }) => post("/api/agents/demand", input);
export const reportProblem = (input: { storeId: string; instanceId?: string; kind: "wrong_message" | "help" | "other"; message: string; context?: Record<string, unknown> }) => post("/api/agents/support", input);
export const confirmOptOut = (token: string) => post("/api/agents/optout", { token });

/* Payment Chaser ------------------------------------------------------------------------------- */

const customerFrom = (r: Row): ChaserCustomer => ({
  id: String(r.id),
  name: String(r.name),
  phone: (r.phone_e164 as string | null) ?? null,
  email: (r.email as string | null) ?? null,
  languagePref: (r.language_pref as ChaserCustomer["languagePref"]) ?? null,
  isPaused: Boolean(r.is_paused),
  optedOutAt: (r.opted_out_at as string | null) ?? null,
  notes: (r.notes as string | null) ?? null,
});
const invoiceFrom = (r: Row): ChaserInvoice => ({
  id: String(r.id),
  customerId: String(r.customer_id),
  invoiceNo: String(r.invoice_no),
  invoiceDate: (r.invoice_date as string | null) ?? null,
  dueDate: String(r.due_date),
  totalMinor: Number(r.amount_total_minor),
  paidMinor: Number(r.amount_paid_minor),
  status: r.status as ChaserInvoice["status"],
  paidAt: (r.paid_at as string | null) ?? null,
  source: String(r.source),
});
const reminderFrom = (r: Row): ChaserReminder => ({
  id: String(r.id),
  customerId: String(r.customer_id),
  invoiceIds: (r.invoice_ids as string[]) ?? [],
  stage: Number(r.stage),
  channel: r.channel as ChaserReminder["channel"],
  tone: String(r.tone),
  language: String(r.language),
  subject: (r.subject as string | null) ?? null,
  body: String(r.body),
  source: String(r.source),
  edited: Boolean(r.edited),
  status: r.status as ChaserReminder["status"],
  scheduledFor: (r.scheduled_for as string | null) ?? null,
  sentAt: (r.sent_at as string | null) ?? null,
  queuedAt: (r.queued_at as string | null) ?? null,
  error: (r.error as string | null) ?? null,
  createdAt: String(r.created_at),
});

/** Every row, paged past PostgREST's 1,000-row answers */
async function all(table: string, cols: string, storeId: string, what: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const q = sb().from(table).select(cols).eq("store_id", storeId);
    const page = rows<Row>(await q.order("created_at").range(from, from + 999), what);
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

export async function getChaserData(): Promise<{ customers: ChaserCustomer[]; invoices: ChaserInvoice[] }> {
  const storeId = await activeStoreId();
  const [c, i] = await Promise.all([
    all("chaser_customers", "id, name, phone_e164, email, language_pref, is_paused, opted_out_at, notes, created_at", storeId, "customers"),
    all("chaser_invoices", "id, customer_id, invoice_no, invoice_date, due_date, amount_total_minor, amount_paid_minor, status, paid_at, source, created_at", storeId, "invoices"),
  ]);
  return { customers: c.map(customerFrom), invoices: i.map(invoiceFrom) };
}

const REMINDER = "id, customer_id, invoice_ids, stage, channel, tone, language, subject, body, source, edited, status, scheduled_for, sent_at, queued_at, error, created_at";

export async function getReminders(o: { customerId?: string; limit?: number } = {}): Promise<ChaserReminder[]> {
  const storeId = await activeStoreId();
  let q = sb().from("chaser_reminders").select(REMINDER).eq("store_id", storeId).order("created_at", { ascending: false }).limit(o.limit ?? 200);
  if (o.customerId) q = q.eq("customer_id", o.customerId);
  return rows<Row>(await q, "reminders").map(reminderFrom);
}

export async function getReminder(id: string): Promise<ChaserReminder> {
  const r = await sb().from("chaser_reminders").select(REMINDER).eq("id", id).maybeSingle();
  if (r.error || !r.data) throw new ApiError("That message wasn't found.", "not_found");
  return reminderFrom(r.data as Row);
}

export async function getLatestImport(): Promise<ChaserImport | null> {
  const storeId = await activeStoreId();
  const r = await sb().from("chaser_imports").select("id, file_name, source, rows_total, rows_imported, rows_updated, rows_failed, error_report, missing_invoice_ids, status, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (r.error) throw new ApiError("We couldn't load your last upload.");
  const x = r.data as Row | null;
  return x
    ? {
        id: String(x.id),
        fileName: String(x.file_name),
        source: String(x.source),
        rowsTotal: Number(x.rows_total),
        rowsImported: Number(x.rows_imported),
        rowsUpdated: Number(x.rows_updated),
        rowsFailed: Number(x.rows_failed),
        errorReport: (x.error_report as ChaserImport["errorReport"]) ?? [],
        missingInvoiceIds: (x.missing_invoice_ids as string[]) ?? [],
        status: x.status as ChaserImport["status"],
        createdAt: String(x.created_at),
      }
    : null;
}

export async function chaserOp<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const storeId = await activeStoreId();
  return post<T>("/api/agents/chaser", { storeId, ...body });
}

export async function chaserExportUrl(): Promise<string> {
  return `/api/agents/chaser?storeId=${encodeURIComponent(await activeStoreId())}`;
}

/* Admin (PowerProof staff) --------------------------------------------------------------------- */

export async function adminGet<T>(view: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams({ view, ...params });
  const res = await fetch(`/api/agents/admin?${q}`, { cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: T; message?: string };
  if (!res.ok || !j.ok) throw new ApiError(j.message ?? "We couldn't load this.");
  return j.data as T;
}

export const adminOp = (body: Record<string, unknown>) => post("/api/agents/admin", body);
