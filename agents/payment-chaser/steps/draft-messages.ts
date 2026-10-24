import type { StepCtx } from "@/lib/server/agents/runtime/types";
import { REMINDER_PROMPT_VERSION } from "../prompts/reminder";
import { MAX_CHARS, PLACEHOLDERS, REQUIRED, staticTemplate } from "../templates";
import { chaserSettings, factsFor, render } from "../lib/render";
import type { LoadOutput } from "./load-overdue";

export interface DraftOutput {
  today: string;
  keys: string[];
  skipped: Record<string, number>;
  drafted: number;
}

type InvoiceRow = { id: string; invoice_no: string; due_date: string; amount_total_minor: number; amount_paid_minor: number };

/**
 * Think: one wording per stage, tone, language and channel (cached per store), written by the model
 * from placeholders only, then filled with this customer's facts by code. A reminder that already
 * exists for the same key is left alone, so the owner's edits survive re-runs.
 */
export async function draftMessages(ctx: StepCtx, input: LoadOutput): Promise<DraftOutput> {
  const s = chaserSettings(ctx.settings);
  const keys = input.items.map((i) => ctx.idempotencyKey(i.key));
  if (!keys.length) return { today: input.today, keys, skipped: input.skipped, drafted: 0 };

  const existing = new Set((await ctx.db.select<{ idempotency_key: string }>("chaser_reminders", "idempotency_key", { idempotency_key: keys })).map((r) => r.idempotency_key));
  const invoiceIds = [...new Set(input.items.flatMap((i) => i.invoiceIds))];
  const [invoices, customers] = await Promise.all([
    ctx.db.select<InvoiceRow>("chaser_invoices", "id, invoice_no, due_date, amount_total_minor, amount_paid_minor", { id: invoiceIds }),
    ctx.db.select<{ id: string; name: string }>("chaser_customers", "id, name", { id: [...new Set(input.items.map((i) => i.customerId))] }),
  ]);
  const inv = new Map(invoices.map((i) => [i.id, i]));
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const variables = Object.fromEntries(PLACEHOLDERS.map((p) => [p, `{{${p}}}`]));
  let drafted = 0;

  for (const [n, item] of input.items.entries()) {
    const key = keys[n];
    if (existing.has(key)) continue;
    const fallback = staticTemplate(item.stage, item.tone, item.language, item.channel);
    const wording = await ctx.llm.draft({
      prompt: "reminder",
      input: { stage: item.stage, tone: item.tone, language: item.language, channel: item.channel, variables },
      required: REQUIRED,
      maxChars: MAX_CHARS[item.channel],
      wantsSubject: item.channel === "email",
      fallback,
      cacheKey: `reminder:v${REMINDER_PROMPT_VERSION}:${item.stage}:${item.tone}:${item.language}:${item.channel}`,
    });
    const facts = factsFor({
      customerName: names.get(item.customerId) ?? "there",
      invoices: item.invoiceIds.map((id) => inv.get(id)).filter((i): i is InvoiceRow => !!i).map((i) => ({ invoiceNo: i.invoice_no, dueDate: i.due_date, outstandingMinor: i.amount_total_minor - i.amount_paid_minor })),
      businessName: s.sender_name || ctx.business.name,
      payDetails: s.pay_details,
      today: input.today,
    });
    let filled: { subject: string | null; body: string };
    let source = wording.source;
    try {
      filled = render(wording, facts);
    } catch {
      // The model's wording lost a fact once filled in: use the static template instead
      filled = render(fallback, facts);
      source = "fallback";
    }
    await ctx.db.upsert(
      "chaser_reminders",
      [
        {
          customer_id: item.customerId,
          invoice_ids: item.invoiceIds,
          stage: item.stage,
          anchor: item.anchor,
          channel: item.channel,
          tone: item.tone,
          language: item.language,
          template_subject: source === "fallback" ? fallback.subject : wording.subject,
          template_body: source === "fallback" ? fallback.body : wording.body,
          subject: filled.subject,
          body: filled.body,
          facts,
          source,
          status: "drafted",
          scheduled_for: ctx.now.toISOString(),
          idempotency_key: key,
          run_id: ctx.runId,
        },
      ],
      "idempotency_key",
      { ignoreDuplicates: true }
    );
    drafted++;
  }
  return { today: input.today, keys, skipped: input.skipped, drafted };
}
