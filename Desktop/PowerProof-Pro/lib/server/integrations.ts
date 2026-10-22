import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sbAdmin } from "@/lib/supabase/admin";
import { sbServer } from "@/lib/supabase/server";
import { AI_PROVIDERS, aiConfigSchema, type AiProvider, type IntegrationKind, type IntegrationView } from "@/lib/integrations";
import type { OwnAi } from "@/lib/pages/ai-run";

/**
 * A store's own connections, stored with their secrets encrypted (AES-256-GCM). The key is
 * INTEGRATIONS_KEY (any long random string) or, without it, one derived from the service-role
 * key, so secrets are never stored in the clear. Changing whichever key is in use means the
 * secrets have to be typed in again.
 */
export class IntegrationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function key(): Buffer {
  const base = process.env.INTEGRATIONS_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new IntegrationError("Connections can't be saved on this deployment yet.", 503);
  return createHash("sha256").update(`powerproof-integrations:${base}`).digest();
}

export function sealSecrets(secrets: Record<string, string>): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(secrets), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function openSecrets(sealed: string | null | undefined): Record<string, string> {
  if (!sealed) return {};
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) return {};
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8"));
  } catch {
    // The key changed: the secrets are gone and have to be typed in again
    return {};
  }
}

/** Whether a store's owner is on Pro (connections are a Pro feature) */
export async function storeIsPro(storeId: string): Promise<boolean> {
  const db = sbAdmin();
  const { data: store } = await db.from("stores").select("owner_id").eq("id", storeId).maybeSingle();
  if (!store) return false;
  const { data: p } = await db.from("profiles").select("plan").eq("id", store.owner_id).maybeSingle();
  return p?.plan === "pro";
}

/** The signed-in person must own the store. Returns whether it's on Pro. */
export async function assertOwner(storeId: string): Promise<{ pro: boolean }> {
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new IntegrationError("Log in again to change connections.", 401);
  const { data: ok } = await db.rpc("is_store_owner", { p_store: storeId });
  if (ok !== true) throw new IntegrationError("Only the store's owner can change its connections.", 403);
  return { pro: await storeIsPro(storeId) };
}

export interface Integration {
  provider: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  enabled: boolean;
}

/** A store's connection with its secrets opened. Pro only: on Free it's as if none was set. */
export async function loadIntegration(storeId: string, kind: IntegrationKind): Promise<Integration | null> {
  const { data } = await sbAdmin().from("store_integrations").select("provider, config, secret_enc, enabled").eq("store_id", storeId).eq("kind", kind).maybeSingle();
  if (!data || !data.enabled || !(await storeIsPro(storeId))) return null;
  return { provider: data.provider, config: (data.config ?? {}) as Record<string, unknown>, secrets: openSecrets(data.secret_enc), enabled: data.enabled };
}

export async function listIntegrations(storeId: string): Promise<IntegrationView[]> {
  const { data } = await sbAdmin().from("store_integrations").select("kind, provider, config, secret_enc, enabled, updated_at").eq("store_id", storeId);
  return (data ?? []).map((r) => ({
    kind: r.kind as IntegrationKind,
    provider: r.provider,
    config: (r.config ?? {}) as Record<string, unknown>,
    enabled: r.enabled,
    updatedAt: r.updated_at,
    secrets: Object.keys(openSecrets(r.secret_enc)).filter((k) => !!openSecrets(r.secret_enc)[k]),
  }));
}

/** Saves a connection. Secret fields left empty keep what was saved before (same provider). */
export async function saveIntegration(storeId: string, kind: IntegrationKind, input: { provider: string; config: Record<string, unknown>; secrets: Record<string, string>; enabled: boolean }) {
  const db = sbAdmin();
  const { data: before } = await db.from("store_integrations").select("provider, secret_enc").eq("store_id", storeId).eq("kind", kind).maybeSingle();
  const kept = before && before.provider === input.provider ? openSecrets(before.secret_enc) : {};
  const secrets = { ...kept, ...Object.fromEntries(Object.entries(input.secrets).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])) };
  const r = await db.from("store_integrations").upsert({ store_id: storeId, kind, provider: input.provider, config: input.config as never, secret_enc: Object.keys(secrets).length ? sealSecrets(secrets) : null, enabled: input.enabled, updated_at: new Date().toISOString() });
  if (r.error) {
    console.error("[integrations] save failed", r.error.message);
    throw new IntegrationError("We couldn't save that connection. Try again.", 500);
  }
}

export async function removeIntegration(storeId: string, kind: IntegrationKind) {
  const r = await sbAdmin().from("store_integrations").delete().eq("store_id", storeId).eq("kind", kind);
  if (r.error) throw new IntegrationError("We couldn't remove that connection. Try again.", 500);
}

/** The store's own AI provider, ready to call, when it has one for this use (and is on Pro) */
export async function ownAiFor(storeId: string, use: "builder" | "pages"): Promise<OwnAi | null> {
  const i = await loadIntegration(storeId, "ai");
  if (!i || !i.secrets.apiKey || !(i.provider in AI_PROVIDERS)) return null;
  const c = aiConfigSchema.safeParse(i.config);
  if (!c.success || c.data.use[use] === false) return null;
  return { provider: i.provider as AiProvider, apiKey: i.secrets.apiKey, baseUrl: c.data.baseUrl, route: c.data.route, model: c.data.model, extra: c.data.extra, headers: c.data.headers };
}
