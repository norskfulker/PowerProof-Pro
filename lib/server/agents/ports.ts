import "server-only";
import { siteUrl } from "@/lib/site-url";
import type { InstanceStatus } from "@/lib/agents/define";
import { agentsAdmin, must, storeDb } from "./db";
import { pickProvider } from "./llm/providers";
import type { ProviderId } from "./llm/gateway";
import { sendAgentMail } from "./mail";
import { optOutToken } from "./optout";
import type { Ports } from "./runtime/context";
import type { Connection, LogLevel } from "./runtime/types";

/**
 * The real platform behind a step context: Supabase (service role, pinned to one store), Resend,
 * the configured model provider. Every side effect goes through a database function with an
 * idempotency key, so a repeated run changes nothing.
 */

export interface InstanceRow {
  id: string;
  store_id: string;
  agent_id: string;
  status: InstanceStatus;
  settings: Record<string, unknown>;
  consent_at: string | null;
  run_every_minutes: number | null;
  next_run_at: string | null;
  paused_reason: string | null;
}

export interface StoreInfo {
  id: string;
  name: string;
  invoice_name: string | null;
  support_email: string | null;
  country: string;
  owner_id: string;
}

export async function loadStoreInfo(storeId: string): Promise<StoreInfo> {
  return must(await agentsAdmin().from("stores").select("id, name, invoice_name, support_email, country, owner_id").eq("id", storeId).single(), "read store") as unknown as StoreInfo;
}

export async function ownerEmail(ownerId: string): Promise<string | null> {
  const { data } = await agentsAdmin().from("profiles").select("email").eq("id", ownerId).maybeSingle();
  return (data?.email as string | null) ?? null;
}

export const businessName = (s: StoreInfo) => s.invoice_name?.trim() || s.name;

export async function platformSettings(): Promise<{ runs_enabled: boolean; sending_enabled: boolean; llm_provider: ProviderId; cost_rates: Record<string, unknown> }> {
  const row = must(await agentsAdmin().from("agent_platform_settings").select("runs_enabled, sending_enabled, llm_provider, cost_rates").eq("id", true).maybeSingle(), "read agent settings");
  return (row ?? { runs_enabled: true, sending_enabled: true, llm_provider: "gemini", cost_rates: {} }) as never;
}

/** Masks a phone or email for logs: +91••••••3210, ra••••@example.com */
export function maskAddress(a: string): string {
  if (a.includes("@")) {
    const [u, d] = a.split("@");
    return `${u.slice(0, 2)}••••@${d}`;
  }
  return `${a.slice(0, 3)}••••••${a.slice(-4)}`;
}

function logger(level: LogLevel, message: string, data?: Record<string, unknown>) {
  // Counts and ids only; steps never pass customer data here
  const line = JSON.stringify({ at: "agents", level, message, ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function productionPorts(o: { instance: InstanceRow; store: StoreInfo; llmProvider: ProviderId; llmModel: string }): Ports {
  const sb = agentsAdmin();
  const storeId = o.instance.store_id;
  const db = storeDb(storeId, sb);
  const displayName = businessName(o.store);

  return {
    db,
    async connection(type) {
      // The connection this instance is linked to for that type, else the store's own (reused across agents)
      const links = must(await sb.from("agent_instance_connections").select("connection_id").eq("instance_id", o.instance.id), "read links") as { connection_id: string }[];
      const { data } = await sb
        .from("agent_connections")
        .select("id, type, status, config")
        .eq("store_id", storeId)
        .eq("type", type)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as unknown as Connection[];
      return rows.find((r) => links.some((l) => l.connection_id === r.id)) ?? rows[0] ?? null;
    },
    llm: {
      provider: pickProvider(o.llmProvider, o.llmModel),
      cache: {
        async get(key) {
          const { data } = await sb.from("agent_llm_cache").select("subject, body").eq("store_id", storeId).eq("cache_key", key).maybeSingle();
          return data ? { subject: (data.subject as string | null) ?? null, body: data.body as string } : null;
        },
        async put(key, v) {
          await sb.from("agent_llm_cache").upsert({ store_id: storeId, cache_key: key, subject: v.subject, body: v.body });
        },
      },
      async meter(u) {
        await sb.from("agent_llm_usage").insert({ store_id: storeId, agent_id: o.instance.agent_id, provider: u.provider, model: u.model, input_tokens: u.inputTokens, output_tokens: u.outputTokens, ok: u.ok });
      },
    },
    messaging: {
      smsEnabled: false,
      async stopped() {
        const [p, cat, inst] = await Promise.all([
          sb.from("agent_platform_settings").select("sending_enabled").eq("id", true).maybeSingle(),
          sb.from("agent_catalog").select("enabled").eq("id", o.instance.agent_id).maybeSingle(),
          sb.from("agent_instances").select("status").eq("id", o.instance.id).maybeSingle(),
        ]);
        return p.data?.sending_enabled === false || cat.data?.enabled === false || !["trial", "active"].includes(String(inst.data?.status));
      },
      async reserve(r) {
        const rows = must(
          await sb.rpc("agent_outbox_reserve", {
            p_store: storeId,
            p_instance: o.instance.id,
            p_agent: o.instance.agent_id,
            p_channel: r.channel,
            p_to: r.to,
            p_contact_key: r.contactKey,
            p_subject: r.subject,
            p_body: r.body,
            p_key: r.idempotencyKey,
            p_credits: r.credits,
            p_reason: r.creditReason,
            p_cap_messages: r.limits.capMessages,
            p_cap_days: r.limits.capDays,
            p_daily_cap: r.limits.dailyCap,
          }),
          "reserve message"
        ) as { result: string; outbox_id: string | null; outbox_status: string | null }[];
        const row = rows[0];
        if (row.result === "reserved") return { result: "reserved", outboxId: row.outbox_id! };
        if (row.result === "duplicate") return { result: "duplicate", outboxId: row.outbox_id!, status: row.outbox_status ?? "" };
        return { result: row.result as "frequency_cap" | "daily_cap" | "no_credits" | "opted_out" };
      },
      async deliverEmail(m) {
        const r = await sendAgentMail({ displayName, to: m.to, subject: m.subject, text: m.text, html: m.html, replyTo: m.replyTo });
        if (r.sent) return { ok: true };
        logger("warn", "email not sent", { to: maskAddress(m.to), reason: r.reason });
        return { ok: false, error: r.reason === "not_configured" ? "Email isn't set up on this site yet." : (r.detail ?? "The email service didn't accept it.") };
      },
      async finish(id, f) {
        must(await sb.rpc("agent_outbox_finish", { p_id: id, p_status: f.status, p_provider_id: f.providerId ?? null, p_error: f.error ?? null }), "finish message");
      },
      async enqueueAction(a) {
        must(
          await sb.from("agent_action_items").upsert(
            { store_id: storeId, instance_id: o.instance.id, kind: a.kind, title: a.title.slice(0, 200), body: a.body?.slice(0, 4000) ?? null, payload: a.payload ?? {}, ref_type: a.ref?.type ?? null, ref_id: a.ref?.id ?? null, idempotency_key: a.idempotencyKey },
            { onConflict: "idempotency_key", ignoreDuplicates: true }
          ),
          "queue action"
        );
      },
      optOutUrl: (outboxId) => `${siteUrl()}/agents/optout/${optOutToken(outboxId)}`,
    },
    async enqueueAction(a) {
      must(
        await sb.from("agent_action_items").upsert(
          { store_id: storeId, instance_id: o.instance.id, kind: a.kind, title: a.title.slice(0, 200), body: a.body?.slice(0, 4000) ?? null, payload: a.payload ?? {}, ref_type: a.ref?.type ?? null, ref_id: a.ref?.id ?? null, idempotency_key: a.idempotencyKey },
          { onConflict: "idempotency_key", ignoreDuplicates: true }
        ),
        "queue action"
      );
    },
    credits: {
      async balance() {
        return Number(must(await sb.rpc("agent_credit_balance", { p_store: storeId }), "read credits"));
      },
      async charge(n, reason, key) {
        const r = must(await sb.rpc("agent_charge_credits", { p_store: storeId, p_agent: o.instance.agent_id, p_n: n, p_reason: reason, p_key: key }), "charge credits");
        return r === "charged" || r === "duplicate";
      },
    },
    log: logger,
  };
}
