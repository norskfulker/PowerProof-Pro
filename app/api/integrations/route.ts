import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_PROVIDERS, aiConfigSchema, PAYMENT_PROVIDERS, type AiProvider, type PaymentProvider } from "@/lib/integrations";
import { assertOwner, IntegrationError, listIntegrations, loadIntegration, removeIntegration, saveIntegration } from "@/lib/server/integrations";
import { siteUrl } from "@/lib/site-url";

/**
 * A store's own connections (Pro): its payment gateway and its AI provider. The owner only.
 * GET lists them (never the secrets), PUT saves one, DELETE removes one, POST tests one.
 */
export const dynamic = "force-dynamic";

const kind = z.enum(["payment", "ai"]);
const ok = (body: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...body }, { headers: { "cache-control": "no-store" } });
const reply = (e: unknown) => {
  if (e instanceof IntegrationError) return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
  console.error("[integrations]", e instanceof Error ? e.message : e);
  return NextResponse.json({ ok: false, message: "Something went wrong. Try again in a minute." }, { status: 500 });
};
const bad = (message: string) => NextResponse.json({ ok: false, message }, { status: 400 });

export async function GET(request: Request) {
  const storeId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("storeId"));
  if (!storeId.success) return bad("That request wasn't right.");
  try {
    const { pro } = await assertOwner(storeId.data);
    return ok({ pro, items: await listIntegrations(storeId.data), webhooks: { custom: `${siteUrl()}/api/webhooks/gateway?gw=custom`, stripe: `${siteUrl()}/api/webhooks/gateway?gw=stripe` } });
  } catch (e) {
    return reply(e);
  }
}

const saveBody = z.object({
  storeId: z.string().uuid(),
  kind,
  provider: z.string().min(1).max(40),
  config: z.record(z.string(), z.unknown()).default({}),
  secrets: z.record(z.string(), z.string().max(4000)).default({}),
  enabled: z.boolean().default(true),
});

/** Checks the settings for the provider and keeps only the fields it has */
function clean(k: "payment" | "ai", provider: string, config: Record<string, unknown>, secrets: Record<string, string>) {
  if (k === "payment") {
    const spec = PAYMENT_PROVIDERS[provider as PaymentProvider];
    if (!spec) throw new IntegrationError("Pick a payment provider.");
    const out: Record<string, string> = {};
    for (const f of spec.fields.filter((x) => !x.secret)) {
      const v = String(config[f.key] ?? "").trim().slice(0, 300);
      if (!v && !f.optional) throw new IntegrationError(`Fill in ${f.label}.`);
      if (v && f.url && !/^https:\/\/[^\s]+$/.test(v)) throw new IntegrationError(`${f.label} must be an https:// address.`);
      if (v) out[f.key] = v;
    }
    const keep = new Set(spec.fields.filter((x) => x.secret).map((x) => x.key));
    return { config: out, secrets: Object.fromEntries(Object.entries(secrets).filter(([key]) => keep.has(key))) };
  }
  if (!(provider in AI_PROVIDERS)) throw new IntegrationError("Pick an AI provider.");
  const c = aiConfigSchema.safeParse(config);
  if (!c.success) throw new IntegrationError(c.error.issues[0]?.message ?? "Check the AI settings.");
  return { config: c.data, secrets: secrets.apiKey !== undefined ? { apiKey: secrets.apiKey } : ({} as Record<string, string>) };
}

export async function PUT(request: Request) {
  const p = saveBody.safeParse(await request.json().catch(() => null));
  if (!p.success) return bad("That request wasn't right.");
  try {
    const { pro } = await assertOwner(p.data.storeId);
    if (!pro) throw new IntegrationError("Your own payment gateway and AI provider are part of the Pro plan.", 402);
    const c = clean(p.data.kind, p.data.provider, p.data.config, p.data.secrets);
    await saveIntegration(p.data.storeId, p.data.kind, { provider: p.data.provider, config: c.config, secrets: c.secrets, enabled: p.data.enabled });
    // Every required secret has to be there after saving
    const saved = await listIntegrations(p.data.storeId);
    const row = saved.find((x) => x.kind === p.data.kind);
    const needed = p.data.kind === "payment" ? PAYMENT_PROVIDERS[p.data.provider as PaymentProvider].fields.filter((f) => f.secret && !f.optional).map((f) => f) : [{ key: "apiKey", label: "API key" }];
    const missing = needed.find((f) => !row?.secrets.includes(f.key));
    return ok({ item: row, warning: missing ? `Add the ${missing.label} to start using it.` : undefined });
  } catch (e) {
    return reply(e);
  }
}

export async function DELETE(request: Request) {
  const p = z.object({ storeId: z.string().uuid(), kind }).safeParse(await request.json().catch(() => null));
  if (!p.success) return bad("That request wasn't right.");
  try {
    await assertOwner(p.data.storeId);
    await removeIntegration(p.data.storeId, p.data.kind);
    return ok();
  } catch (e) {
    return reply(e);
  }
}

/** The error message a provider sent back, as " It said: …", or "" */
async function providerMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; description?: string } | string; message?: string } | null;
  const e = body?.error;
  const text = (typeof e === "string" ? e : e?.message ?? e?.description) ?? body?.message;
  return text ? ` It said: ${String(text).slice(0, 200)}` : "";
}

/** Tries the saved connection with a harmless request */
export async function POST(request: Request) {
  const p = z.object({ storeId: z.string().uuid(), kind }).safeParse(await request.json().catch(() => null));
  if (!p.success) return bad("That request wasn't right.");
  try {
    const { pro } = await assertOwner(p.data.storeId);
    if (!pro) throw new IntegrationError("Your own payment gateway and AI provider are part of the Pro plan.", 402);
    const i = await loadIntegration(p.data.storeId, p.data.kind, { includeOff: true });
    if (!i) throw new IntegrationError("Save the connection first.", 404);
    const signal = AbortSignal.timeout(15000);
    let res: Response | null = null;
    if (p.data.kind === "payment") {
      if (i.provider === "own_razorpay") res = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { authorization: `Basic ${Buffer.from(`${i.config.keyId}:${i.secrets.keySecret ?? ""}`).toString("base64")}` }, signal }).catch(() => null);
      else if (i.provider === "stripe") res = await fetch("https://api.stripe.com/v1/balance", { headers: { authorization: `Bearer ${i.secrets.secretKey ?? ""}` }, signal }).catch(() => null);
      else return ok({ message: "Saved. Custom gateways are tested by a real order: place a small one in your store." });
    } else {
      const c = aiConfigSchema.parse(i.config);
      const base = c.baseUrl.replace(/\/+$/, "");
      const provider = i.provider as AiProvider;
      const headers: Record<string, string> = { "content-type": "application/json", ...c.headers };
      if (provider === "anthropic") res = await fetch(`${base}${c.route || "/messages"}`, { method: "POST", headers: { ...headers, "x-api-key": i.secrets.apiKey ?? "", "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: c.model, max_tokens: 8, messages: [{ role: "user", content: "Reply with OK." }] }), signal }).catch(() => null);
      else if (provider === "gemini") res = await fetch(`${base}/models/${encodeURIComponent(c.model)}:generateContent`, { method: "POST", headers: { ...headers, "x-goog-api-key": i.secrets.apiKey ?? "" }, body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with OK." }] }] }), signal }).catch(() => null);
      // No token limit: newer OpenAI models refuse max_tokens, and other servers name it differently
      else res = await fetch(`${base}${c.route || "/chat/completions"}`, { method: "POST", headers: { ...headers, authorization: `Bearer ${i.secrets.apiKey ?? ""}` }, body: JSON.stringify({ model: c.model, messages: [{ role: "user", content: "Reply with OK." }] }), signal }).catch(() => null);
    }
    if (!res) throw new IntegrationError("We couldn't reach it. Check the address and try again.", 502);
    if (!res.ok) {
      // The provider's own words help most ("model not found", "insufficient credit"…)
      const said = await providerMessage(res);
      if (res.status === 401 || res.status === 403) throw new IntegrationError(`The key was refused. Check it and save again.${said}`, 400);
      if (res.status === 404) throw new IntegrationError(`The address, route or model wasn't found.${said}`, 400);
      throw new IntegrationError(`It answered with an error (${res.status}).${said}`, 400);
    }
    return ok({ message: "Connected. It works." });
  } catch (e) {
    return reply(e);
  }
}
