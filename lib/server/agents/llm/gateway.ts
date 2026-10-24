import { checkWording, describeProblem } from "@/lib/agents/guardrails";
import type { DraftRequest, DraftResult } from "../runtime/types";

/**
 * One way to ask a model for wording, whichever provider is switched on. The gateway sends the
 * agent's system prompt and a JSON input, expects {"subject","body"} back, checks it (placeholders,
 * no digits, length, forbidden phrases), retries once, and otherwise returns the static template.
 * Providers differ only in how they're called; switching changes nothing else.
 */

export type ProviderId = "gemini" | "anthropic";

export interface Completion {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Provider {
  id: ProviderId;
  complete(o: { system: string; user: string; maxOutputTokens: number; timeoutMs: number }): Promise<Completion>;
}

export interface GatewayDeps {
  provider: Provider | null;
  /** The system prompt for a prompt name */
  systemPrompt(name: string): string;
  forbidden: readonly string[];
  cache: { get(key: string): Promise<{ subject: string | null; body: string } | null>; put(key: string, v: { subject: string | null; body: string }): Promise<void> };
  meter(u: { provider: ProviderId; model: string; inputTokens: number; outputTokens: number; ok: boolean }): Promise<void>;
  timeoutMs?: number;
}

function parseAnswer(text: string): { subject: string | null; body: string } | null {
  // Models sometimes wrap JSON in a code fence
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const j = JSON.parse(raw) as { subject?: unknown; body?: unknown };
    if (typeof j.body !== "string") return null;
    const subject = typeof j.subject === "string" && j.subject.trim() ? j.subject.trim() : null;
    return { subject, body: j.body.trim() };
  } catch {
    return null;
  }
}

export async function draftWith(deps: GatewayDeps, req: DraftRequest): Promise<DraftResult> {
  const cached = await deps.cache.get(req.cacheKey);
  if (cached) return { ...cached, source: "cache" };
  if (!deps.provider) return { ...req.fallback, source: "fallback", reason: "No AI provider is set up." };

  // The placeholders the agent offered (input.variables) are the only ones the model may use
  const offered = Object.keys((req.input.variables as Record<string, unknown> | undefined) ?? {});
  const rules = { required: req.required, allowed: [...offered, ...req.required.map((r) => r.replace(/[{}\s]/g, ""))], maxChars: req.maxChars, forbidden: deps.forbidden };
  let reason = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let c: Completion;
    try {
      c = await deps.provider.complete({ system: deps.systemPrompt(req.prompt), user: JSON.stringify(req.input), maxOutputTokens: 1200, timeoutMs: deps.timeoutMs ?? 20_000 });
    } catch (e) {
      reason = `The AI didn't answer (${e instanceof Error ? e.message.slice(0, 120) : "error"}).`;
      await deps.meter({ provider: deps.provider.id, model: "unknown", inputTokens: 0, outputTokens: 0, ok: false });
      continue;
    }
    const answer = parseAnswer(c.text);
    const problem = !answer
      ? "The AI's answer wasn't the expected JSON."
      : (() => {
          const p = checkWording(answer.body, rules) ?? (req.wantsSubject ? (answer.subject ? checkWording(answer.subject, { ...rules, required: [], maxChars: 120 }) : { code: "empty" as const }) : null);
          return p ? describeProblem(p) : null;
        })();
    await deps.meter({ provider: deps.provider.id, model: c.model, inputTokens: c.inputTokens, outputTokens: c.outputTokens, ok: !problem });
    if (answer && !problem) {
      const out = { subject: req.wantsSubject ? answer.subject : null, body: answer.body };
      await deps.cache.put(req.cacheKey, out);
      return { ...out, source: "llm" };
    }
    reason = problem ?? "";
  }
  return { ...req.fallback, source: "fallback", reason };
}
