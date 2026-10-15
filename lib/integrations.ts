import { z } from "zod";

/**
 * A store's own connections (Pro): its payment gateway and its AI provider. Shared by the
 * settings screen and the server. Secrets are typed in, sent once, encrypted on the server and
 * never shown again (the screen only says one is saved).
 */

export type IntegrationKind = "payment" | "ai";
export type PaymentProvider = "own_razorpay" | "stripe" | "custom";
export type AiProvider = "openai" | "anthropic" | "gemini";

export interface FieldSpec {
  key: string;
  label: string;
  /** Encrypted on the server; never sent back to the browser */
  secret?: boolean;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  /** A URL (https only) */
  url?: boolean;
}

export const PAYMENT_PROVIDERS: Record<PaymentProvider, { label: string; about: string; fields: FieldSpec[] }> = {
  own_razorpay: {
    label: "Razorpay (your account)",
    about: "Buyers pay in Razorpay's window as now, straight into your own Razorpay account.",
    fields: [
      { key: "keyId", label: "Key id", placeholder: "rzp_live_…" },
      { key: "keySecret", label: "Key secret", secret: true },
    ],
  },
  stripe: {
    label: "Stripe",
    about: "Buyers go to Stripe Checkout to pay, then come back to their order.",
    fields: [
      { key: "publishableKey", label: "Publishable key", placeholder: "pk_live_…", optional: true },
      { key: "secretKey", label: "Secret key", secret: true, placeholder: "sk_live_…" },
      { key: "webhookSecret", label: "Webhook signing secret", secret: true, optional: true, placeholder: "whsec_…", hint: "Optional, recommended: confirms payments even if the buyer closes the tab. Point a checkout.session.completed webhook at the address shown below." },
    ],
  },
  custom: {
    label: "Custom gateway",
    about: "Any provider that can follow a simple signed contract: we ask it for a payment link, and it tells us when the buyer has paid.",
    fields: [
      { key: "name", label: "Name shown to buyers", placeholder: "PayGlocal" },
      { key: "createUrl", label: "Create-payment URL", url: true, placeholder: "https://api.yourgateway.com/powerproof/payments", hint: "We POST the order here and expect { \"paymentUrl\": \"https://…\" } back." },
      { key: "apiKey", label: "API key", secret: true, hint: "Sent as Authorization: Bearer <key>." },
      { key: "webhookSecret", label: "Signing secret", secret: true, hint: "Signs both directions (HMAC-SHA256 of the raw body, hex) in the X-PowerProof-Signature header." },
    ],
  },
};

export const AI_PROVIDERS: Record<AiProvider, { label: string; about: string; baseUrl: string; models: string[] }> = {
  openai: { label: "OpenAI-compatible", about: "OpenAI, OpenRouter, Groq, Together, DeepSeek, Mistral, a local server… anything with a /chat/completions route.", baseUrl: "https://api.openai.com/v1", models: ["gpt-5.1", "gpt-5.1-mini", "gpt-4.1"] },
  anthropic: { label: "Anthropic (Claude)", about: "Claude through Anthropic's Messages API.", baseUrl: "https://api.anthropic.com/v1", models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] },
  gemini: { label: "Google Gemini", about: "Gemini with your own Google AI Studio key.", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-3.8-flash", "gemini-3.8-pro"] },
};

/** The AI connection's settings that aren't secret */
export const aiConfigSchema = z.object({
  baseUrl: z.string().trim().url("Enter the full https:// address.").max(300).refine((u) => u.startsWith("https://"), "Use an https:// address."),
  /** The route under the base URL; empty uses the provider's usual one */
  route: z.string().trim().max(120).regex(/^(\/[\w\-./:{}]*)?$/, "A route starts with /, like /chat/completions.").default(""),
  model: z.string().trim().min(1, "Pick or type a model.").max(120),
  /** Extra JSON merged into every request body (temperature, max_tokens, response_format…) */
  extra: z.record(z.string(), z.unknown()).default({}),
  /** Extra request headers (not secret) */
  headers: z.record(z.string().regex(/^[A-Za-z0-9-]{1,60}$/), z.string().max(500)).default({}),
  /** Where to use it: the AI store builder, page building, writing help */
  use: z.object({ builder: z.boolean().default(true), pages: z.boolean().default(true) }).default({ builder: true, pages: true }),
});
export type AiConfig = z.infer<typeof aiConfigSchema>;

/** What the settings screen sees: never the secrets, only whether one is saved */
export interface IntegrationView {
  kind: IntegrationKind;
  provider: string;
  config: Record<string, unknown>;
  enabled: boolean;
  updatedAt: string;
  /** Names of the secret fields that are saved */
  secrets: string[];
}

/** The JSON file people can download and load back (secrets left out) */
export const integrationFileSchema = z.object({
  powerproof: z.literal("integration"),
  kind: z.enum(["payment", "ai"]),
  provider: z.string().min(1).max(40),
  config: z.record(z.string(), z.unknown()),
});
