import { fillPlaceholders } from "@/lib/agents/guardrails";
import { istDay } from "@/lib/agents/time";
import type { SendOutcome, StepCtx } from "@/lib/server/agents/runtime/types";
import { chaserSettings, factsFor, render } from "../lib/render";
import type { DraftOutput } from "./draft-messages";
import { CUSTOMER_COLS, customerFrom } from "./load-overdue";

export interface PreviewMessage {
  customer: string;
  channel: string;
  subject: string | null;
  body: string;
  outcome: string;
}

export interface SendOutput {
  counts: Record<string, number>;
  /** Dry runs: exactly what would go out */
  preview: PreviewMessage[];
  skipped: Record<string, number>;
}

type ReminderRow = { id: string; customer_id: string; invoice_ids: string[]; channel: "email" | "whatsapp" | "sms"; subject: string | null; body: string; template_subject: string | null; template_body: string; facts: Record<string, string>; edited: boolean; status: string; idempotency_key: string };
type InvoiceRow = { id: string; invoice_no: string; due_date: string; amount_total_minor: number; amount_paid_minor: number; status: string };

const sameFacts = (a: Record<string, string>, b: Record<string, string>) => Object.keys(b).every((k) => a?.[k] === b[k]);

/**
 * Act: just before sending, re-read the invoices (a paid one stops its reminder here), refresh the
 * facts, then hand each message to the platform pipeline: email goes out, WhatsApp is queued for
 * the owner's tap. Reminders that can't go yet (outside hours, cap, no credits) stay drafted and
 * are picked up by the next hourly run.
 */
export async function routeAndSend(ctx: StepCtx, input: DraftOutput): Promise<SendOutput> {
  const s = chaserSettings(ctx.settings);
  const counts: Record<string, number> = {};
  const preview: PreviewMessage[] = [];
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  if (!input.keys.length) return { counts, preview, skipped: input.skipped };

  const reminders = await ctx.db.select<ReminderRow>("chaser_reminders", "id, customer_id, invoice_ids, channel, subject, body, template_subject, template_body, facts, edited, status, idempotency_key", { idempotency_key: input.keys, status: ["drafted", "approved"] });
  const invoices = await ctx.db.select<InvoiceRow>("chaser_invoices", "id, invoice_no, due_date, amount_total_minor, amount_paid_minor, status", { id: [...new Set(reminders.flatMap((r) => r.invoice_ids))] });
  const customers = await ctx.db.select<Parameters<typeof customerFrom>[0]>("chaser_customers", CUSTOMER_COLS, { id: [...new Set(reminders.map((r) => r.customer_id))] });
  const inv = new Map(invoices.map((i) => [i.id, i]));
  const cust = new Map(customers.map((c) => [c.id, customerFrom(c)]));
  const nowIso = ctx.now.toISOString();

  for (const r of reminders) {
    const c = cust.get(r.customer_id);
    const open = r.invoice_ids.map((id) => inv.get(id)).filter((i): i is InvoiceRow => !!i && i.status === "open" && i.amount_total_minor > i.amount_paid_minor);
    if (!c || !open.length) {
      if (!ctx.dryRun) await ctx.db.update("chaser_reminders", { status: "skipped", error: "Paid or closed before sending.", updated_at: nowIso }, { id: r.id });
      bump("paid_before_send");
      continue;
    }
    // A reply asked for time: the reminder waits (drafted) and goes on a later run
    if (c.snoozedUntil && c.snoozedUntil > istDay(ctx.now)) {
      bump("snoozed");
      continue;
    }
    if (c.isPaused || c.optedOutAt) {
      if (!ctx.dryRun) await ctx.db.update("chaser_reminders", { status: "skipped", error: c.isPaused ? "Customer paused." : "Customer opted out.", updated_at: nowIso }, { id: r.id });
      bump(c.isPaused ? "paused" : "opted_out");
      continue;
    }

    // Facts as they are now: a part-payment or a newly paid invoice changes the amount
    const facts = factsFor({
      customerName: c.name,
      invoices: open.map((i) => ({ invoiceNo: i.invoice_no, dueDate: i.due_date, outstandingMinor: i.amount_total_minor - i.amount_paid_minor })),
      businessName: s.sender_name || ctx.business.name,
      payDetails: s.pay_details,
      today: input.today,
    });
    let subject = r.subject;
    let body = r.body;
    if (!sameFacts(r.facts, facts)) {
      if (r.edited) {
        // The owner rewrote it by hand and the facts have changed since: ask before sending
        if (!ctx.dryRun) {
          await ctx.db.update("chaser_reminders", { status: "snoozed", error: "Amounts changed after you edited this message.", updated_at: nowIso }, { id: r.id });
          await ctx.actions.enqueue({ kind: "approve_draft", title: `Check the reminder to ${c.name}`, body: "The amounts changed after you edited it. Look it over, then approve.", payload: { reminderId: r.id }, ref: { type: "chaser_reminder", id: r.id }, idempotencyKey: `${r.idempotency_key}:approve` });
        }
        bump("needs_approval");
        continue;
      }
      const filled = render({ subject: r.template_subject, body: r.template_body }, facts);
      subject = filled.subject;
      body = filled.body;
      if (!ctx.dryRun) await ctx.db.update("chaser_reminders", { subject, body, facts, updated_at: nowIso }, { id: r.id });
    }

    const to = r.channel === "email" ? c.email : c.phone;
    const out: SendOutcome = to
      ? await ctx.messages.send({
          channel: r.channel,
          to,
          toName: c.name,
          subject: subject ? fillPlaceholders(subject, facts) : null,
          body,
          contactKey: c.id,
          idempotencyKey: r.idempotency_key,
          creditReason: r.channel === "email" ? "email_sent" : r.channel === "sms" ? "sms_sent" : "whatsapp_queued",
          replyTo: ctx.business.supportEmail ?? undefined,
          title: `WhatsApp ${c.name}`,
          ref: { type: "chaser_reminder", id: r.id },
        })
      : { status: "skipped", reason: "invalid_recipient" };

    if (ctx.dryRun) {
      preview.push({ customer: c.name, channel: r.channel, subject, body, outcome: out.status === "skipped" ? out.reason : "would_send" });
      bump(out.status === "skipped" ? out.reason : "would_send");
      continue;
    }
    switch (out.status) {
      case "sent":
        await ctx.db.update("chaser_reminders", { status: "sent", sent_at: nowIso, provider_message_id: out.outboxId, error: null, updated_at: nowIso }, { id: r.id });
        break;
      case "queued":
        await ctx.db.update("chaser_reminders", { status: "queued", queued_at: nowIso, provider_message_id: out.outboxId, error: null, updated_at: nowIso }, { id: r.id });
        break;
      case "failed":
        await ctx.db.update("chaser_reminders", { status: "failed", error: out.error.slice(0, 300), updated_at: nowIso }, { id: r.id });
        break;
      case "skipped":
        if (out.reason === "opted_out") {
          await ctx.db.update("chaser_customers", { opted_out_at: nowIso }, { id: c.id });
          await ctx.db.update("chaser_reminders", { status: "skipped", error: "Customer opted out.", updated_at: nowIso }, { id: r.id });
        } else if (out.reason === "invalid_recipient") {
          await ctx.db.update("chaser_reminders", { status: "skipped", error: "No valid contact for this channel.", updated_at: nowIso }, { id: r.id });
        } else if (out.reason !== "duplicate") {
          // Outside hours, caps, credits, paused: stays drafted for the next run
          await ctx.db.update("chaser_reminders", { scheduled_for: out.retryAt ?? nowIso, error: out.reason, updated_at: nowIso }, { id: r.id });
        }
        break;
    }
    bump(out.status === "skipped" ? out.reason : out.status);
  }
  const said = [
    counts.sent ? `${counts.sent} emailed` : "",
    counts.queued ? `${counts.queued} WhatsApp ready in your queue` : "",
    counts.would_send ? `${counts.would_send} would go out` : "",
    counts.outside_window ? `${counts.outside_window} waiting for sending hours` : "",
    counts.no_credits ? `${counts.no_credits} waiting for credits` : "",
    counts.snoozed ? `${counts.snoozed} waiting after a reply` : "",
    counts.paid_before_send ? `${counts.paid_before_send} paid before sending` : "",
    counts.failed ? `${counts.failed} didn't send` : "",
  ].filter(Boolean);
  if (said.length) ctx.say(said.join(" · "), counts.failed || counts.no_credits ? "warn" : "ok");
  return { counts, preview, skipped: input.skipped };
}
