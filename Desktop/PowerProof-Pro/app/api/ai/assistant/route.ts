import "server-only";
import { ApiError as GeminiApiError, FunctionCallingConfigMode, GoogleGenAI, type Content } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ASSISTANT_TOOLS, type AssistantReply } from "@/lib/assistant/tools";
import { aiConnected, GEMINI_PAGE_MODEL } from "@/lib/pages/ai-run";
import { allow } from "@/lib/server/limit";
import { sbServer } from "@/lib/supabase/server";

/**
 * The dashboard AI assistant's one step: POST { contents, store } → the model's next turn (text,
 * and/or tool calls). The browser runs the tool calls with lib/api as the signed-in creator and
 * sends the results back here for the next step, so this route never touches store data: it holds
 * the Gemini key, checks who's asking and limits how often.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const json = (body: AssistantReply, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
const fail = (message: string, status: number) => json({ ok: false, message }, status);

const schema = z.strictObject({
  contents: z.array(z.strictObject({ role: z.enum(["user", "model"]), parts: z.array(z.record(z.unknown())).min(1).max(40) })).min(1).max(80),
  store: z.strictObject({ name: z.string().max(120), currency: z.string().max(3), sells: z.string().max(10), live: z.boolean(), today: z.string().max(40) }),
});

function systemPrompt(store: z.infer<typeof schema>["store"]): string {
  return [
    "You are the PowerProof assistant inside a creator's store dashboard. PowerProof lets independent creators sell digital downloads and physical products from their own store.",
    `The store: ${store.name} (prices in ${store.currency}, sells ${store.sells === "both" ? "digital and physical products" : `${store.sells} products`}, ${store.live ? "live" : "not live yet"}). Today is ${store.today} (India time).`,
    "Use the tools to answer with real numbers and to do the work the creator asks for: add and edit products, make them live, create discount codes, change store details, look at sales, orders and customers. Never invent figures, products, orders or ids: read them with a tool.",
    "Prices you pass are in major units of the store's currency (499 means 499.00).",
    "A store can hold digital and physical products, but only one kind can be live at a time. Before making a product live, check which kind is live; if it's the other kind, offer switch_live_kind (one step: the live kind goes to drafts, the other goes live) and use it once the creator agrees or asked to switch.",
    "Do what's asked without extra questions when it's clear. Ask one short question only when something essential is missing. Before archiving products or making the store live, make sure the creator asked for it.",
    "When a tool returns an error, explain it simply and say what the creator can do (often a button with open_page).",
    "Answer briefly, in the creator's language, in plain sentences. Short lists are fine. No markdown headings, tables or emoji.",
  ].join("\n");
}

export async function POST(request: Request) {
  const sb = await sbServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail("Log in again to use the assistant.", 401);
  if (!aiConnected()) return fail("The AI assistant isn't connected yet.", 501);
  const raw = await request.text();
  if (raw.length > 400_000) return fail("This conversation is too long. Start a new one.", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("Something went wrong sending that. Try again.", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Something went wrong sending that. Try again.", 400);
  if (!allow(`ai-assistant:${auth.user.id}`, 120, 60 * 60_000)) return fail("That's a lot of requests in a row. Wait a few minutes and try again.", 429);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || GEMINI_PAGE_MODEL,
      contents: parsed.data.contents as Content[],
      config: {
        systemInstruction: systemPrompt(parsed.data.store),
        tools: [{ functionDeclarations: Object.entries(ASSISTANT_TOOLS).map(([name, t]) => ({ name, description: t.description, parametersJsonSchema: t.parameters })) }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        maxOutputTokens: 4000,
        abortSignal: request.signal,
      },
    });
    const parts = res.candidates?.[0]?.content?.parts;
    if (!parts?.length) return fail(res.promptFeedback?.blockReason ? "The assistant can't help with that." : "The assistant didn't answer. Try again.", 502);
    // The model's turn goes back exactly as it came (thought signatures included)
    return json({ ok: true, content: { role: "model", parts: JSON.parse(JSON.stringify(parts)) } });
  } catch (e) {
    if (request.signal.aborted) return fail("Stopped.", 499);
    console.error("[ai/assistant]", e instanceof Error ? e.message : e);
    if (e instanceof GeminiApiError && e.status === 429) return fail("The assistant is busy right now. Try again in a minute.", 429);
    return fail("The assistant isn't available right now. Try again in a minute.", 503);
  }
}
