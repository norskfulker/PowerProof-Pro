import "server-only";
import { GoogleGenAI } from "@google/genai";
import { countryByCode } from "../countries";
import { fromMajor } from "../money";
import { GEMINI_PAGE_MODEL } from "../pages/ai-run";
import { PALETTES } from "../palettes";
import { AI_STORE_JSON_SCHEMA, AI_STORE_MAX_PRODUCTS, aiStoreDraftSchema, type AiStoreDraft, type AiStoreRequest } from "../onboarding/ai-store";
import type { ImportedProduct } from "../import/map";

/**
 * Drafts a whole store from a few words (and, optionally, the creator's own products brought from
 * a link): names, tagline, colours, About, FAQ, collections and draft products. One Gemini call that
 * answers in JSON, checked against aiStoreDraftSchema. Nothing is saved here.
 */

export class AiStoreError extends Error {}

function systemPrompt(): string {
  return [
    "You set up online stores for independent creators and small businesses.",
    "From the creator's description, draft their store: up to three store names (short, memorable, no domain endings), a tagline, a colour palette, whether it sells digital downloads or physical goods, an About story written in the first person as the creator, an FAQ buyers would really ask, a few collections, and the products they described.",
    "Rules:",
    "- Use only what the creator told you. Never invent reviews, numbers of customers, awards, testimonials, guarantees, delivery times, discounts or contact details.",
    "- When the creator lists products, draft those. When they don't, draft at most four clear starter products that match what they said, and add a note asking them to check each one.",
    "- suggestedPrice is only an idea in major units for the creator to accept or change. Use 0 when you can't tell.",
    "- FAQ answers must not promise anything the creator didn't say (refund days, delivery, formats). Prefer questions about what's included, who it's for and how to get it.",
    "- Notes are short, plain instructions for the creator: what to check or add before opening the store (a file to deliver for each digital product, real prices, a photo).",
    "- Write every word buyers see in the requested language. Plain text only: no markdown, no emoji.",
  ].join("\n");
}

function userPrompt(req: AiStoreRequest, imported: ImportedProduct[], label?: string): string {
  const country = countryByCode(req.country);
  const lines = [
    `Language: ${req.language}`,
    `Based in: ${country.name} (prices in ${country.currency})`,
    `Palettes to choose from: ${PALETTES.map((p) => `${p.name} (${p.bg})`).join(", ")}`,
    "",
    "The creator describes their business:",
    req.description,
  ];
  if (imported.length) {
    lines.push(
      "",
      `They brought these products from their own ${label ? `shop (${label})` : "shop"}. These are real and come across as they are, so return "products": [] and use them only to understand the store, its collections and its FAQ:`,
      ...imported.slice(0, 20).map((p) => `- ${p.title}${p.collections.length ? ` [${p.collections.join(", ")}]` : ""}: ${p.description.replace(/\s+/g, " ").slice(0, 240)}`)
    );
  }
  return lines.join("\n");
}

/** The draft, with products from the creator's link (real prices) or AI's (suggested prices only) */
export async function draftStore(req: AiStoreRequest, imported: ImportedProduct[], opts: { label?: string; signal?: AbortSignal } = {}): Promise<AiStoreDraft> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const currency = countryByCode(req.country).currency;
  let raw: string | undefined;
  try {
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || GEMINI_PAGE_MODEL,
      contents: [{ role: "user", parts: [{ text: userPrompt(req, imported, opts.label) }] }],
      config: {
        systemInstruction: systemPrompt(),
        responseMimeType: "application/json",
        responseJsonSchema: AI_STORE_JSON_SCHEMA,
        maxOutputTokens: 12000,
        abortSignal: opts.signal,
      },
    });
    raw = res.text;
  } catch (e) {
    console.error("[ai/store] gemini failed", e instanceof Error ? e.message : e);
    throw new AiStoreError("AI couldn't draft your store just now. Try again in a minute.");
  }
  let json: unknown;
  try {
    json = JSON.parse(raw ?? "");
  } catch {
    throw new AiStoreError("AI's answer came back incomplete. Try again.");
  }
  const obj = (json && typeof json === "object" ? json : {}) as { products?: { suggestedPrice?: unknown }[] };
  // Suggestions arrive in major units; the draft keeps minor units like the rest of the app
  const products = imported.length
    ? imported.slice(0, AI_STORE_MAX_PRODUCTS).map((p) => ({ title: p.title, description: p.description, kind: "other", collection: p.collections[0] ?? "", price: p.price > 0 ? p.price : undefined, sourceUrl: p.sourceUrl }))
    : (obj.products ?? []).map((p) => {
        const major = typeof p.suggestedPrice === "number" && p.suggestedPrice > 0 ? p.suggestedPrice : 0;
        return { ...p, suggestedPrice: major ? fromMajor(major, currency).amount : undefined, price: undefined };
      });
  const parsed = aiStoreDraftSchema.safeParse({ ...obj, products });
  if (!parsed.success) {
    console.error("[ai/store] draft didn't fit", parsed.error.issues[0]);
    throw new AiStoreError("AI's draft didn't come out right. Try again, or add a few more words.");
  }
  const draft = parsed.data;
  // Collections from the link come along even if AI didn't name them
  const named = new Set(draft.collections.map((c) => c.toLowerCase()));
  for (const p of draft.products) if (p.collection && !named.has(p.collection.toLowerCase()) && draft.collections.length < 5) {
    draft.collections.push(p.collection);
    named.add(p.collection.toLowerCase());
  }
  return draft;
}
