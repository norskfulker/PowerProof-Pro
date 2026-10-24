import { describe, expect, it } from "vitest";
import type { DraftRequest } from "../runtime/types";
import { draftWith, type GatewayDeps, type Provider } from "./gateway";
import { anthropicProvider } from "./providers";

const req: DraftRequest = {
  prompt: "reminder",
  input: { stage: 1, tone: "friendly", language: "english", channel: "whatsapp", variables: { customer_name: "{{customer_name}}", amount: "{{amount}}" } },
  required: ["{{customer_name}}", "{{amount}}"],
  maxChars: 400,
  wantsSubject: false,
  fallback: { subject: null, body: "Hi {{customer_name}}, {{amount}} is due." },
  cacheKey: "k1",
};

function deps(answers: (string | Error)[], seen: string[] = []): GatewayDeps & { metered: number; cached: Map<string, unknown> } {
  const cached = new Map<string, { subject: string | null; body: string }>();
  const provider: Provider = {
    id: "gemini",
    async complete({ user }) {
      seen.push(user);
      const a = answers.shift();
      if (a instanceof Error || a === undefined) throw a ?? new Error("no answer");
      return { text: a, model: "m", inputTokens: 10, outputTokens: 5 };
    },
  };
  const d = {
    provider,
    systemPrompt: () => "system",
    forbidden: ["legal action"],
    cache: { get: async (k: string) => cached.get(k) ?? null, put: async (k: string, v: { subject: string | null; body: string }) => void cached.set(k, v) },
    metered: 0,
    cached,
    meter: async () => void d.metered++,
  };
  return d;
}

describe("LLM gateway", () => {
  it("returns checked wording and caches it", async () => {
    const d = deps([JSON.stringify({ subject: null, body: "Hello {{customer_name}}, {{amount}} is pending. When can you pay?" })]);
    const r = await draftWith(d, req);
    expect(r.source).toBe("llm");
    expect((await draftWith(d, req)).source).toBe("cache");
    expect(d.metered).toBe(1);
  });

  it("retries once, then falls back to the template on a forced failure", async () => {
    const r = await draftWith(deps([new Error("down"), new Error("down")]), req);
    expect(r).toMatchObject({ source: "fallback", body: req.fallback.body });
  });

  it("refuses an answer that invents a number or a threat", async () => {
    const r = await draftWith(deps([JSON.stringify({ body: "{{customer_name}}, pay {{amount}} in 3 days." }), JSON.stringify({ body: "{{customer_name}}, pay {{amount}} or legal action follows." })]), req);
    expect(r.source).toBe("fallback");
  });

  it("works with no provider configured", async () => {
    expect((await draftWith({ ...deps([]), provider: null }, req)).source).toBe("fallback");
  });

  it("sends the model placeholders only, never customer data", async () => {
    const seen: string[] = [];
    await draftWith(deps([JSON.stringify({ body: "Hi {{customer_name}}, {{amount}} is due. Date?" })], seen), req);
    expect(seen[0]).toContain("{{customer_name}}");
    expect(seen[0]).not.toMatch(/₹|\d{3,}/);
  });

  it("calls Anthropic with the same request shape", async () => {
    let body: { system?: string; messages?: { content: string }[] } = {};
    const p = anthropicProvider({ ANTHROPIC_API_KEY: "k" }, "default", (async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ content: [{ type: "text", text: '{"subject":null,"body":"x"}' }], usage: { input_tokens: 3, output_tokens: 2 } }));
    }) as unknown as typeof fetch)!;
    const c = await p.complete({ system: "sys", user: "{}", maxOutputTokens: 100, timeoutMs: 1000 });
    expect(body.system).toBe("sys");
    expect(c).toMatchObject({ text: '{"subject":null,"body":"x"}', inputTokens: 3, outputTokens: 2 });
  });
});
