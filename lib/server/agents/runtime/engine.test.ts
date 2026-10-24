import { describe, expect, it } from "vitest";
import { defineAgent } from "@/lib/agents/define";
import { runSteps, type Checkpoints } from "./engine";
import { defineSteps, RetryableError, type StepCtx } from "./types";

const manifest = defineAgent({
  id: "engine-test",
  version: "1.0.0",
  name: "Engine test",
  tagline: "t",
  description: "d",
  category: "Testing",
  status: "hidden",
  dataPrefix: "eng_",
  trial: { credits: 1 },
  plans: [],
  creditCosts: {},
  llm: { provider: "gemini", model: "default" },
  connectors: [],
  setup: [],
  triggers: [{ type: "manual" }],
  steps: ["a", "b", "c"],
  actionQueue: [],
  metrics: [],
  consents: [],
  guardrails: { forbiddenPhrases: [], maxMessagesPerContactPerDays: { messages: 1, days: 1 }, sendWindow: "09:00-20:00", dailySendCap: 1 },
  howItWorks: [],
  sample: { title: "s", lines: [] },
  help: { faq: [] },
});

function store(): Checkpoints & { saved: Record<string, unknown> } {
  const saved: Record<string, unknown> = {};
  return { saved, load: async () => ({ ...saved }), done: async (s, o) => void (saved[s] = o), failed: async () => {} };
}

describe("agent engine", () => {
  it("passes each step's output to the next", async () => {
    const calls: string[] = [];
    const { steps } = defineSteps(manifest, {
      a: async () => (calls.push("a"), 1),
      b: async (_c: StepCtx, n: number) => (calls.push("b"), n + 1),
      c: async (_c: StepCtx, n: number) => (calls.push("c"), n * 10),
    });
    expect(await runSteps(manifest, steps, {} as StepCtx, store())).toMatchObject({ ok: true, output: 20 });
    expect(calls).toEqual(["a", "b", "c"]);
  });

  it("resumes after a failure without repeating finished steps", async () => {
    const calls: string[] = [];
    let failOnce = true;
    const { steps } = defineSteps(manifest, {
      a: async () => (calls.push("a"), "x"),
      b: async () => {
        calls.push("b");
        if (failOnce) {
          failOnce = false;
          throw new RetryableError("provider down", 60);
        }
        return "y";
      },
      c: async () => (calls.push("c"), "z"),
    });
    const cp = store();
    expect(await runSteps(manifest, steps, {} as StepCtx, cp)).toMatchObject({ ok: false, step: "b", retryable: true, retryInSeconds: 60 });
    expect(await runSteps(manifest, steps, {} as StepCtx, cp)).toMatchObject({ ok: true, output: "z" });
    expect(calls).toEqual(["a", "b", "b", "c"]);
  });

  it("stops between steps when out of time", async () => {
    const { steps } = defineSteps(manifest, { a: async () => 1, b: async () => 2, c: async () => 3 });
    expect(await runSteps(manifest, steps, {} as StepCtx, store(), { deadline: Date.now() - 1 })).toMatchObject({ ok: false, retryable: true, step: "a" });
  });

  it("refuses an agent whose code doesn't match its manifest", () => {
    expect(() => defineSteps(manifest, { a: async () => 1, b: async () => 1 })).toThrow(/no code for step/);
    expect(() => defineSteps(manifest, { a: async () => 1, b: async () => 1, c: async () => 1, d: async () => 1 })).toThrow(/aren't in the manifest/);
  });
});
