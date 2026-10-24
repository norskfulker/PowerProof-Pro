import { GoogleGenAI } from "@google/genai";
import type { Provider, ProviderId } from "./gateway";

/** Same default as the page builder (lib/pages/ai-run.ts), which is server-only and so not imported here */
const GEMINI_PAGE_MODEL = "gemini-3.8-flash";

/**
 * The two model providers behind the agent LLM gateway. Gemini is the default and reuses the app's
 * own setup (GEMINI_API_KEY, GEMINI_MODEL); Anthropic is plain HTTPS with ANTHROPIC_API_KEY (no SDK,
 * so no new dependency). Admin can switch the platform default; a manifest can name its own.
 */

export const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-5-5";

export function geminiProvider(env: Record<string, string | undefined> = process.env, model?: string): Provider | null {
  if (!env.GEMINI_API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const name = model && model !== "default" ? model : env.GEMINI_MODEL || GEMINI_PAGE_MODEL;
  return {
    id: "gemini",
    async complete({ system, user, maxOutputTokens, timeoutMs }) {
      const res = await ai.models.generateContent({
        model: name,
        contents: [{ role: "user", parts: [{ text: user }] }],
        config: { systemInstruction: system, responseMimeType: "application/json", maxOutputTokens, abortSignal: AbortSignal.timeout(timeoutMs) },
      });
      return { text: res.text ?? "", model: name, inputTokens: res.usageMetadata?.promptTokenCount ?? 0, outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0 };
    },
  };
}

export function anthropicProvider(env: Record<string, string | undefined> = process.env, model?: string, fetcher: typeof fetch = fetch): Provider | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  const name = model && model !== "default" ? model : env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL;
  return {
    id: "anthropic",
    async complete({ system, user, maxOutputTokens, timeoutMs }) {
      const res = await fetcher("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: name, max_tokens: maxOutputTokens, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`Anthropic answered ${res.status}`);
      const j = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
      const text = (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      return { text, model: name, inputTokens: j.usage?.input_tokens ?? 0, outputTokens: j.usage?.output_tokens ?? 0 };
    },
  };
}

/** The provider for a run: the admin override, else the manifest's choice, falling back to whichever is configured */
export function pickProvider(wanted: ProviderId, model: string, env: Record<string, string | undefined> = process.env): Provider | null {
  const first = wanted === "anthropic" ? anthropicProvider(env, model) : geminiProvider(env, model);
  return first ?? (wanted === "anthropic" ? geminiProvider(env) : anthropicProvider(env));
}
