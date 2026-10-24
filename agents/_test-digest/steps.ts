import { defineSteps } from "@/lib/server/agents/runtime/types";
import manifest from "./manifest";

export default defineSteps(manifest, {
  collect: async (ctx) => {
    const sheet = await ctx.connectors.get("google_sheets");
    return { sheet: sheet ? String(sheet.config.name ?? "your sheet") : null };
  },
  compose: async (ctx, input: { sheet: string | null }) => {
    if (!input.sheet) return { body: null };
    const d = await ctx.llm.draft({
      prompt: "digest",
      input: { sheet: input.sheet },
      required: ["{{sheet}}"],
      maxChars: 200,
      wantsSubject: false,
      fallback: { subject: null, body: "Your sheet {{sheet}} has news." },
      cacheKey: ctx.idempotencyKey("digest", input.sheet),
    });
    return { body: d.body.replaceAll("{{sheet}}", input.sheet) };
  },
  deliver: async (ctx, input: { body: string | null }) => {
    if (!input.body) return { sent: false };
    const out = await ctx.messages.send({
      channel: "email",
      to: String(ctx.settings.owner_email),
      subject: "Your digest",
      body: input.body,
      contactKey: "owner",
      idempotencyKey: ctx.idempotencyKey("deliver", ctx.now.toISOString().slice(0, 10)),
      creditReason: "digest_sent",
    });
    return { sent: out.status === "sent" || out.status === "dry_run", status: out.status };
  },
}, { digest: "Write a one-line digest about {{sheet}}. Output JSON only: {\"subject\": null, \"body\": string}." });
