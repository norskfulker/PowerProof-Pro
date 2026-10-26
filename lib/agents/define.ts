import { z } from "zod";

/**
 * Agents are a folder with a manifest (`agents/<id>/manifest.ts`) plus small server steps. The
 * catalog card, agent page, setup wizard, dashboard numbers, credit costs, consent screen and the
 * scheduler entry are all read from the manifest, so nothing agent-specific is written into the app.
 * This file is shared by the browser and the server: it holds data shapes only, never server code.
 */

/**
 * Credits are bought in any number at one flat price (founder, 25 Oct 2026: $0.08 each). One credit
 * is one finished piece of work, whatever the agent; a failed one gives its credit back.
 */
export const CREDIT_PRICE = { perCreditMinor: 8, currency: "USD", min: 10, max: 100_000 } as const;

/** What `n` credits cost, in cents */
export const creditsCostMinor = (n: number) => Math.round(n) * CREDIT_PRICE.perCreditMinor;

export const connectorTypes = ["verified_email", "invoice_source", "google_sheets", "sms_provider"] as const;
export type ConnectorType = (typeof connectorTypes)[number];

export const actionKinds = ["whatsapp_send", "needs_personal_call", "approve_draft", "review_reply"] as const;
export type ActionKind = (typeof actionKinds)[number];

export const instanceStatuses = ["setup", "trial", "active", "paused", "trial_ended", "suspended"] as const;
export type InstanceStatus = (typeof instanceStatuses)[number];

const fieldBase = { key: z.string().regex(/^[a-z][a-z0-9_]*$/), label: z.string().min(1), hint: z.string().optional() };

/** A setup question. The wizard and the Settings tab draw these; the server validates answers with `settingsSchema` */
export const setupFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...fieldBase, type: z.literal("text"), default: z.string().default(""), maxLength: z.number().int().positive().default(80) }),
  z.object({ ...fieldBase, type: z.literal("select"), options: z.array(z.object({ value: z.string(), label: z.string() })).min(1), default: z.string() }),
  z.object({ ...fieldBase, type: z.literal("multiselect"), options: z.array(z.object({ value: z.string(), label: z.string(), disabled: z.string().optional() })).min(1), default: z.array(z.string()) }),
  z.object({ ...fieldBase, type: z.literal("number"), min: z.number(), max: z.number(), default: z.number() }),
  z.object({ ...fieldBase, type: z.literal("time_range"), default: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/) }),
  z.object({ ...fieldBase, type: z.literal("day_list"), default: z.array(z.number().int().min(0).max(365)).min(1).max(8) }),
]);
export type SetupField = z.infer<typeof setupFieldSchema>;

export const connectorSchema = z.object({
  key: z.string(),
  type: z.enum(connectorTypes),
  label: z.string(),
  why: z.string(),
  required: z.boolean().default(true),
  /** Ways to connect, in the order the wizard offers them */
  options: z.array(z.enum(["csv", "xlsx", "manual", "sheets", "email"])).default([]),
  /** Off until a flag (e.g. SMS needs a provider and DLT registration) */
  disabledUntil: z.string().optional(),
});

export const metricSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["money", "count"]),
  /** Tap-to-explain text: how the number is worked out, in plain words */
  explain: z.string(),
  headline: z.boolean().default(false),
});

export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  status: z.enum(["live", "coming_soon", "hidden"]),
  /** The agent's own tables start with this (Payment Chaser: "chaser_"); steps can't touch anything else */
  dataPrefix: z.string().regex(/^[a-z]+_$/),
  trial: z.object({ credits: z.number().int().positive(), days: z.number().int().positive().optional() }),
  plans: z.array(z.object({ id: z.string(), priceMinor: z.number().int().nonnegative(), launchPriceMinor: z.number().int().nonnegative().optional(), currency: z.literal("INR"), includedCredits: z.number().int().nonnegative() })),
  /** Credits per action. One credit is one request; actions the owner doesn't see as a request cost 0 */
  creditCosts: z.record(z.string(), z.number().int().nonnegative()),
  llm: z.object({ provider: z.enum(["gemini", "anthropic"]), model: z.string() }),
  connectors: z.array(connectorSchema),
  setup: z.array(setupFieldSchema),
  triggers: z.array(z.discriminatedUnion("type", [z.object({ type: z.literal("cron"), everyMinutes: z.number().int().min(10) }), z.object({ type: z.literal("manual") })])),
  steps: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1),
  actionQueue: z.array(z.enum(actionKinds)),
  metrics: z.array(metricSchema),
  report: z.object({ schedule: z.literal("weekly_monday_9am_ist"), template: z.string() }).optional(),
  consents: z.array(z.string().min(1)),
  guardrails: z.object({ forbiddenPhrases: z.array(z.string()), maxMessagesPerContactPerDays: z.object({ messages: z.number().int().positive(), days: z.number().int().positive() }), /** Hours (India time) when messages may go out on their own, e.g. "09:00-20:00" */ sendWindow: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/), dailySendCap: z.number().int().positive() }),
  howItWorks: z.array(z.object({ step: z.string(), title: z.string(), body: z.string() })),
  sample: z.object({ title: z.string(), lines: z.array(z.string()) }),
  /** Promises shown on the agent's public page ("Paid invoices stop reminders at once") */
  highlights: z.array(z.string()).default([]),
  help: z.object({ faq: z.array(z.object({ q: z.string(), a: z.string() })) }),
  /** The agent's page: getting it running, step by step, in the owner's words */
  instructions: z.array(z.string()).default([]),
  /** The agent's page: what each credit reason means ("email_sent": "An email reminder sent") */
  creditLabels: z.record(z.string(), z.string()).default({}),
  /** The agent's page: what it reads and what it produces */
  formats: z
    .object({
      input: z.array(z.object({ name: z.string(), accepts: z.array(z.string()), columns: z.array(z.object({ name: z.string(), need: z.enum(["required", "optional", "either"]), example: z.string() })) })),
      output: z.array(z.object({ name: z.string(), detail: z.string() })),
    })
    .optional(),
});

export type AgentManifest = z.infer<typeof manifestSchema>;
export type AgentManifestInput = z.input<typeof manifestSchema>;

/** Checks a manifest when the registry loads, so a broken agent fails tests and the build, never a customer's run */
export function defineAgent(m: AgentManifestInput): AgentManifest {
  const parsed = manifestSchema.parse(m);
  if (parsed.howItWorks.some((h) => !parsed.steps.includes(h.step))) throw new Error(`${parsed.id}: howItWorks names a step that isn't in steps`);
  if (new Set(parsed.steps).size !== parsed.steps.length) throw new Error(`${parsed.id}: a step is listed twice`);
  if (new Set(parsed.setup.map((f) => f.key)).size !== parsed.setup.length) throw new Error(`${parsed.id}: two setup fields share a key`);
  return parsed;
}

/** The owner's answers, checked against the manifest's fields (unknown keys dropped, missing ones defaulted) */
export function settingsSchema(m: AgentManifest) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of m.setup) {
    switch (f.type) {
      case "text":
        shape[f.key] = z.string().trim().max(f.maxLength).default(f.default);
        break;
      case "select":
        shape[f.key] = z.enum(f.options.map((o) => o.value) as [string, ...string[]]).default(f.default);
        break;
      case "multiselect": {
        const allowed = f.options.filter((o) => !o.disabled).map((o) => o.value);
        shape[f.key] = z.array(z.string()).transform((v) => [...new Set(v)].filter((x) => allowed.includes(x))).pipe(z.array(z.string()).min(1, `Pick at least one for ${f.label}.`)).default(f.default);
        break;
      }
      case "number":
        shape[f.key] = z.coerce.number().int().min(f.min).max(f.max).default(f.default);
        break;
      case "time_range":
        shape[f.key] = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, `Use HH:MM-HH:MM for ${f.label}.`).default(f.default);
        break;
      case "day_list":
        shape[f.key] = z.array(z.coerce.number().int().min(0).max(365)).min(1).max(8).transform((v) => [...new Set(v)].sort((a, b) => a - b)).default(f.default);
        break;
    }
  }
  return z.object(shape).strip();
}

export function defaultSettings(m: AgentManifest): Record<string, unknown> {
  return settingsSchema(m).parse({});
}

/** The cron interval in minutes, or null for manual-only agents */
export function cronEvery(m: AgentManifest): number | null {
  const t = m.triggers.find((x) => x.type === "cron");
  return t && t.type === "cron" ? t.everyMinutes : null;
}
