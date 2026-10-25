import "server-only";
import { AGENTS, getManifest } from "@/agents/index";
import { CREDIT_PRICE } from "@/lib/agents/define";
import { agentsAdmin, must } from "./db";
import { maskAddress, platformSettings } from "./ports";

/**
 * Numbers for PowerProof staff: demand, the trial-to-paid funnel, failures and the dead-letter
 * list, connection health, support, and margin (what a credit costs us against what it's worth).
 * Read with the server key after is_admin() was checked by the route.
 */

type Row = Record<string, unknown>;
const DAY = 86_400_000;

async function storeNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return new Map();
  const out = new Map<string, string>();
  for (let i = 0; i < uniq.length; i += 150) {
    const rows = must(await agentsAdmin().from("stores").select("id, name").in("id", uniq.slice(i, i + 150)), "read stores") as Row[];
    for (const r of rows) out.set(String(r.id), String(r.name));
  }
  return out;
}

const nameOf = (agentId: string, catalog: Row[]) => getManifest(agentId)?.name ?? String(catalog.find((c) => c.id === agentId)?.name ?? agentId);

export async function adminOverview() {
  const sb = agentsAdmin();
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const [instances, catalog, failed, dead, conns, support, demand, settings] = await Promise.all([
    sb.from("agent_instances").select("agent_id, status, consent_at").limit(20000),
    sb.from("agent_catalog").select("id, name, status, enabled, sort").order("sort"),
    sb.from("agent_runs").select("id", { count: "exact", head: true }).in("status", ["failed", "dead"]).gte("started_at", since),
    sb.from("agent_jobs").select("id", { count: "exact", head: true }).eq("status", "dead"),
    sb.from("agent_connections").select("type, status").limit(20000),
    sb.from("agent_support_items").select("id", { count: "exact", head: true }).eq("status", "open"),
    sb.from("agent_demand_requests").select("id", { count: "exact", head: true }),
    platformSettings(),
  ]);
  const inst = (instances.data ?? []) as Row[];
  const cat = (catalog.data ?? []) as Row[];
  const funnel = cat
    .filter((c) => c.status === "live")
    .map((c) => {
      const mine = inst.filter((i) => i.agent_id === c.id);
      const on = mine.filter((i) => i.consent_at).length;
      const paid = mine.filter((i) => i.status === "active").length;
      return { agentId: String(c.id), name: nameOf(String(c.id), cat), enabled: c.enabled !== false, started: mine.length, switchedOn: on, trial: mine.filter((i) => i.status === "trial").length, trialEnded: mine.filter((i) => i.status === "trial_ended").length, paused: mine.filter((i) => i.status === "paused").length, paid, conversionPct: on ? Math.round((paid / on) * 1000) / 10 : 0 };
    });
  const c = (conns.data ?? []) as Row[];
  return {
    funnel,
    failedRuns7d: failed.count ?? 0,
    deadJobs: dead.count ?? 0,
    connections: { connected: c.filter((x) => x.status === "connected").length, needsReauth: c.filter((x) => x.status === "needs_reauth").length, error: c.filter((x) => x.status === "error").length },
    openSupport: support.count ?? 0,
    demandRequests: demand.count ?? 0,
    switches: { runsEnabled: settings.runs_enabled, sendingEnabled: settings.sending_enabled, llmProvider: settings.llm_provider },
  };
}

export async function adminDemand() {
  const sb = agentsAdmin();
  const [reqs, catalog] = await Promise.all([sb.from("agent_demand_requests").select("id, agent_id, email, mobile, note, store_id, created_at").order("created_at", { ascending: false }).limit(2000), sb.from("agent_catalog").select("id, name, status")]);
  const rows = (reqs.data ?? []) as Row[];
  const cat = (catalog.data ?? []) as Row[];
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(String(r.agent_id), (counts.get(String(r.agent_id)) ?? 0) + 1);
  const leaderboard = cat.map((c) => ({ agentId: String(c.id), name: nameOf(String(c.id), cat), status: String(c.status), requests: counts.get(String(c.id)) ?? 0 })).sort((a, b) => b.requests - a.requests);
  return {
    leaderboard,
    requests: rows.map((r) => ({ id: String(r.id), agent: nameOf(String(r.agent_id), cat), email: maskAddress(String(r.email)), mobile: r.mobile ? maskAddress(String(r.mobile)) : null, note: (r.note as string | null) ?? null, fromStore: !!r.store_id, at: String(r.created_at) })),
  };
}

export async function adminCatalog() {
  const sb = agentsAdmin();
  const [catalog, plans] = await Promise.all([sb.from("agent_catalog").select("*").order("sort"), sb.from("agent_plans").select("*")]);
  return { catalog: (catalog.data ?? []) as Row[], plans: (plans.data ?? []) as Row[], codeAgents: AGENTS.map((a) => a.id) };
}

export async function adminRuns() {
  const sb = agentsAdmin();
  const [runs, jobs] = await Promise.all([
    sb.from("agent_runs").select("id, store_id, agent_id, trigger, status, error, started_at").in("status", ["failed", "dead"]).order("started_at", { ascending: false }).limit(200),
    sb.from("agent_jobs").select("id, store_id, kind, attempts, last_error, updated_at, instance_id").eq("status", "dead").order("updated_at", { ascending: false }).limit(200),
  ]);
  const r = (runs.data ?? []) as Row[];
  const j = (jobs.data ?? []) as Row[];
  const names = await storeNames([...r.map((x) => String(x.store_id)), ...j.map((x) => String(x.store_id))]);
  return {
    runs: r.map((x) => ({ id: String(x.id), store: names.get(String(x.store_id)) ?? "", storeId: String(x.store_id), agent: nameOf(String(x.agent_id), []), trigger: String(x.trigger), status: String(x.status), error: (x.error as string | null) ?? null, at: String(x.started_at) })),
    deadJobs: j.map((x) => ({ id: String(x.id), store: names.get(String(x.store_id)) ?? "", kind: String(x.kind), attempts: Number(x.attempts), error: (x.last_error as string | null) ?? null, at: String(x.updated_at) })),
  };
}

/**
 * Margin for the last 30 days, per agent and per store. Revenue is what was charged through agent
 * billing (none until it opens); "value" is credits used at the list price ($0.08 each). Cost is the
 * model's tokens at the configured rates plus email. A row is flagged when a credit costs more than
 * it's worth.
 */
export async function adminMargin() {
  const sb = agentsAdmin();
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const settings = await platformSettings();
  const rates = settings.cost_rates as { usd_inr?: number; llm?: Record<string, { in: number; out: number }>; email_usd?: number; credit_usd?: number };
  const creditUsd = rates.credit_usd ?? CREDIT_PRICE.perCreditMinor / 100;
  const [ledger, usage, emails, subs] = await Promise.all([
    sb.from("agent_credit_ledger").select("store_id, agent_id, delta, kind").in("kind", ["charge", "release"]).gte("created_at", since).limit(100000),
    sb.from("agent_llm_usage").select("store_id, agent_id, provider, input_tokens, output_tokens").gte("created_at", since).limit(100000),
    sb.from("agent_messages_outbox").select("store_id, agent_id").eq("channel", "email").eq("status", "sent").gte("created_at", since).limit(100000),
    sb.from("agent_payment_events").select("id", { count: "exact", head: true }),
  ]);
  type Acc = { credits: number; llmUsd: number; emailUsd: number; inTok: number; outTok: number };
  const byAgent = new Map<string, Acc>();
  const byStore = new Map<string, Acc & { agentId: string }>();
  const acc = (agent: string, store: string) => {
    if (!byAgent.has(agent)) byAgent.set(agent, { credits: 0, llmUsd: 0, emailUsd: 0, inTok: 0, outTok: 0 });
    const k = `${store}|${agent}`;
    if (!byStore.has(k)) byStore.set(k, { credits: 0, llmUsd: 0, emailUsd: 0, inTok: 0, outTok: 0, agentId: agent });
    return [byAgent.get(agent)!, byStore.get(k)!];
  };
  for (const l of (ledger.data ?? []) as Row[]) for (const a of acc(String(l.agent_id ?? "unknown"), String(l.store_id))) a.credits += -Number(l.delta);
  for (const u of (usage.data ?? []) as Row[]) {
    const r = rates.llm?.[String(u.provider)] ?? { in: 0, out: 0 };
    const usd = (Number(u.input_tokens) * r.in + Number(u.output_tokens) * r.out) / 1_000_000;
    for (const a of acc(String(u.agent_id), String(u.store_id))) {
      a.llmUsd += usd;
      a.inTok += Number(u.input_tokens);
      a.outTok += Number(u.output_tokens);
    }
  }
  for (const e of (emails.data ?? []) as Row[]) for (const a of acc(String(e.agent_id), String(e.store_id))) a.emailUsd += rates.email_usd ?? 0;
  const shape = (a: Acc) => {
    const cost = a.llmUsd + a.emailUsd;
    const perCredit = a.credits > 0 ? cost / a.credits : cost > 0 ? Infinity : 0;
    return { creditsUsed: a.credits, valueUsd: a.credits * creditUsd, llmUsd: a.llmUsd, emailUsd: a.emailUsd, costUsd: cost, costPerCreditUsd: Number.isFinite(perCredit) ? perCredit : null, losing: perCredit > creditUsd, tokens: a.inTok + a.outTok };
  };
  const names = await storeNames([...byStore.keys()].map((k) => k.split("|")[0]));
  return {
    creditUsd,
    usdInr: rates.usd_inr ?? 84,
    revenueNote: (subs.count ?? 0) === 0 ? "Agent billing isn't open yet, so revenue is ₹0; value is credits used at the list price." : null,
    agents: [...byAgent.entries()].map(([agentId, a]) => ({ agentId, name: nameOf(agentId, []), ...shape(a) })),
    stores: [...byStore.entries()].map(([k, a]) => ({ storeId: k.split("|")[0], store: names.get(k.split("|")[0]) ?? "", agent: nameOf(a.agentId, []), ...shape(a) })).sort((x, y) => y.costUsd - x.costUsd).slice(0, 200),
  };
}

export async function adminSupport() {
  const sb = agentsAdmin();
  const rows = (must(await sb.from("agent_support_items").select("id, store_id, kind, message, context, status, created_at").order("created_at", { ascending: false }).limit(300), "read support") ?? []) as Row[];
  const names = await storeNames(rows.map((r) => String(r.store_id)));
  return rows.map((r) => ({ id: String(r.id), store: names.get(String(r.store_id)) ?? "", storeId: String(r.store_id), kind: String(r.kind), message: String(r.message), context: r.context as Record<string, unknown>, status: String(r.status), at: String(r.created_at) }));
}

export async function adminStores() {
  const sb = agentsAdmin();
  const [inst, bal] = await Promise.all([sb.from("agent_instances").select("id, store_id, agent_id, status, paused_reason, last_run_at, created_at").order("created_at", { ascending: false }).limit(2000), sb.from("agent_credit_balances").select("store_id, balance").limit(20000)]);
  const rows = (inst.data ?? []) as Row[];
  const names = await storeNames(rows.map((r) => String(r.store_id)));
  const balances = new Map(((bal.data ?? []) as Row[]).map((b) => [String(b.store_id), Number(b.balance)]));
  return rows.map((r) => ({ id: String(r.id), storeId: String(r.store_id), store: names.get(String(r.store_id)) ?? "", agent: nameOf(String(r.agent_id), []), status: String(r.status), pausedReason: (r.paused_reason as string | null) ?? null, credits: balances.get(String(r.store_id)) ?? 0, lastRunAt: (r.last_run_at as string | null) ?? null, createdAt: String(r.created_at) }));
}

/** Read-only look at one store's agents (support), with contacts masked. The route audits each view. */
export async function adminStoreView(storeId: string) {
  const sb = agentsAdmin();
  const [store, inst, runs, outbox, actions, bal] = await Promise.all([
    sb.from("stores").select("id, name, invoice_name, country").eq("id", storeId).maybeSingle(),
    sb.from("agent_instances").select("id, agent_id, status, paused_reason, settings, consent_at, last_run_at").eq("store_id", storeId),
    sb.from("agent_runs").select("id, agent_id, trigger, status, summary, error, started_at").eq("store_id", storeId).order("started_at", { ascending: false }).limit(30),
    sb.from("agent_messages_outbox").select("id, channel, to_address, status, error, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(50),
    sb.from("agent_action_items").select("id, kind, status, title, created_at").eq("store_id", storeId).in("status", ["open", "snoozed"]).limit(50),
    sb.rpc("agent_credit_balance", { p_store: storeId }),
  ]);
  return {
    store: store.data,
    instances: inst.data ?? [],
    runs: ((runs.data ?? []) as Row[]).map((r) => ({ ...r, summary: { ...(r.summary as Row), preview: undefined } })),
    outbox: ((outbox.data ?? []) as Row[]).map((o) => ({ ...o, to_address: maskAddress(String(o.to_address)) })),
    actions: actions.data ?? [],
    credits: Number(bal.data ?? 0),
  };
}
