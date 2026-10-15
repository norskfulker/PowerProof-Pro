import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { countryByCode } from "@/lib/countries";
import { convertPrices, type ImportedProduct } from "@/lib/import/map";
import { aiStoreRequestSchema, type AiStoreResponse } from "@/lib/onboarding/ai-store";
import { aiConnected } from "@/lib/pages/ai-run";
import { AI_FREE_MESSAGES } from "@/lib/plans";
import { AiStoreError, draftStore } from "@/lib/server/ai-store";
import { ownStore } from "@/lib/server/import/auth";
import { previewLink } from "@/lib/server/import/link";
import { ImportError } from "@/lib/server/import/sources";
import { allow } from "@/lib/server/limit";
import { sbAdmin } from "@/lib/supabase/admin";
import { sbServer } from "@/lib/supabase/server";

/**
 * Sets a store up with AI (onboarding, before the store opens).
 *
 *   POST { description, link?, rights?, country, language }   drafts a whole store: names, tagline,
 *        colours, About, FAQ, collections and draft products. Nothing is saved; the creator reviews
 *        the draft and creates the store from the browser (the usual lib/api calls, so the same
 *        checks apply). With a link, its products come across as they are, prices included.
 *   POST { record: { storeId, link } }   once the store exists, records that the creator brought
 *        products from that link and confirmed they may sell them (store_imports, as "Add from a link" does).
 *
 * Runs on PowerProof's Gemini (there's no store yet, so no store-owned AI). A draft doesn't use one
 * of the free AI messages (those are counted per store in ai_generations); it is rate limited per
 * person instead, and refused once the free messages are used up on the Free plan.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const json = (body: AiStoreResponse | { ok: boolean; message?: string }, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
const fail = (code: Extract<AiStoreResponse, { ok: false }>["code"], message: string, status: number) => json({ ok: false, code, message }, status);

const recordSchema = z.strictObject({ record: z.strictObject({ storeId: z.string(), link: z.string().trim().min(1).max(2000) }) });

export async function POST(request: Request) {
  const sb = await sbServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("signed_out", "Log in again to use AI.", 401);
  const body = (await request.json().catch(() => null)) as unknown;

  const record = recordSchema.safeParse(body);
  if (record.success) {
    const own = await ownStore(record.data.record.storeId);
    if ("error" in own) return own.error;
    await sbAdmin().from("store_imports").insert({ store_id: own.store.id, source: "link", source_label: record.data.record.link.slice(0, 300), proof: { method: "rights_confirmed", detail: "You confirmed you may sell these (store set up with AI)" }, counts: {} });
    return json({ ok: true });
  }

  const parsed = aiStoreRequestSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0].message, 400);
  const req = parsed.data;
  if (!aiConnected()) return fail("not_connected", "AI setup isn't connected yet. Set your store up yourself for now.", 501);
  if (req.link && !req.rights) return fail("invalid", "Confirm you own the products at that link or may sell them.", 400);
  if (!allow(`ai-store:${auth.user.id}`, 6, 60 * 60_000)) return fail("limit", "That's a lot of drafts in a row. Wait a little, or set the store up yourself.", 429);

  const profile = (await sb.from("profiles").select("plan").eq("id", auth.user.id).maybeSingle()).data;
  if ((profile?.plan ?? "free") === "free") {
    const used = (await sb.from("ai_generations").select("id", { count: "exact", head: true }).eq("owner_id", auth.user.id).eq("kind", "page").neq("status", "failed")).count ?? 0;
    if (used >= AI_FREE_MESSAGES) return fail("limit", `You've used your ${AI_FREE_MESSAGES} free AI messages. Set your store up yourself, or upgrade to Pro.`, 429);
  }

  // The creator's own products, when they gave a link
  const currency = countryByCode(req.country).currency;
  const warnings: string[] = [];
  let imported: ImportedProduct[] = [];
  let label: string | undefined;
  if (req.link) {
    try {
      const preview = await previewLink(req.link, currency, { media: false });
      const { data: fx } = await sbAdmin().from("fx_rates").select("currency, per_usd");
      const converted = convertPrices(preview.products, currency, Object.fromEntries((fx ?? []).map((r) => [r.currency, Number(r.per_usd)])));
      imported = converted.products;
      label = preview.label;
      warnings.push(...preview.warnings);
      if (converted.warning) warnings.push(converted.warning);
    } catch (e) {
      if (!(e instanceof ImportError)) console.error("[ai/store] link", e instanceof Error ? e.message : e);
      warnings.push(e instanceof ImportError ? `${e.message} AI drafted the store from your description instead.` : "We couldn't read that link, so AI drafted the store from your description instead.");
    }
  }

  try {
    const draft = await draftStore(req, imported, { label, signal: request.signal });
    return json({ ok: true, draft, warnings });
  } catch (e) {
    if (e instanceof AiStoreError) return fail("unavailable", e.message, 502);
    console.error("[ai/store]", e instanceof Error ? e.message : e);
    return fail("unavailable", "AI setup isn't available right now. Try again, or set your store up yourself.", 503);
  }
}
