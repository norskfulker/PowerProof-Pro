import { defineAgent } from "@/lib/agents/define";

/**
 * A dummy second agent, for unit tests only (never in the production registry). It proves a new
 * agent is a folder plus a registry line: it reuses the store's Google Sheet connection and the
 * platform's LLM, messaging and credits with no platform changes.
 */
export default defineAgent({
  id: "test-digest",
  version: "0.0.1",
  name: "Test Digest",
  tagline: "Emails the owner a one-line digest of their sheet.",
  description: "Test agent. Reads the connected sheet's name and emails the owner a short digest.",
  category: "Testing",
  status: "hidden",
  dataPrefix: "digest_",
  trial: { credits: 5 },
  plans: [],
  creditCosts: { digest_sent: 1 },
  llm: { provider: "gemini", model: "default" },
  connectors: [{ key: "sheet", type: "google_sheets", label: "Google Sheet", why: "The sheet to summarise.", options: ["sheets"] }],
  setup: [{ key: "owner_email", type: "text", label: "Send to", default: "", maxLength: 200 }],
  triggers: [{ type: "manual" }],
  steps: ["collect", "compose", "deliver"],
  actionQueue: [],
  metrics: [{ key: "digests", label: "Digests sent", kind: "count", explain: "Digests emailed." }],
  consents: ["I want a digest."],
  guardrails: { forbiddenPhrases: [], maxMessagesPerContactPerDays: { messages: 1, days: 1 }, sendWindow: "00:00-00:00", dailySendCap: 5 },
  howItWorks: [{ step: "collect", title: "Reads", body: "Reads the sheet." }],
  sample: { title: "Digest", lines: ["Your sheet {{sheet}} has news."] },
  help: { faq: [] },
});
