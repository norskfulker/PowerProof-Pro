import { istDay, istInstant } from "@/lib/agents/time";
import { formatMoney } from "@/lib/money";
import type { StepCtx } from "@/lib/server/agents/runtime/types";
import manifest from "../manifest";
import { planReminders, type Customer, type OpenInvoice, type PastReminder, type PlanItem } from "../lib/plan";
import { chaserSettings, rulesFrom } from "../lib/render";

/** "1 invoice" / "3 invoices" */
export const n = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const SKIP_WORDS: Record<string, string> = { paused: "paused", snoozed: "waiting after a reply", opted_out: "opted out", no_contact: "with no email or phone", too_soon: "reminded recently", daily_cap: "over today's limit", needs_personal_call: "to call yourself" };

export interface LoadOutput {
  today: string;
  items: PlanItem[];
  skipped: Record<string, number>;
}

type InvoiceRow = { id: string; customer_id: string; invoice_no: string; due_date: string; amount_total_minor: number; amount_paid_minor: number };
type CustomerRow = { id: string; name: string; phone_e164: string | null; email: string | null; is_paused: boolean; opted_out_at: string | null; language_pref: string | null; snoozed_until?: string | null };
type ReminderRow = { id: string; idempotency_key: string; customer_id: string; stage: number; anchor: string; status: PastReminder["status"]; sent_at: string | null; queued_at: string | null };

export const customerFrom = (c: CustomerRow): Customer => ({ id: c.id, name: c.name, phone: c.phone_e164, email: c.email, isPaused: c.is_paused, optedOutAt: c.opted_out_at, languagePref: c.language_pref === "hinglish" || c.language_pref === "english" ? c.language_pref : null, snoozedUntil: c.snoozed_until ?? null });
export const CUSTOMER_COLS = "id, name, phone_e164, email, is_paused, opted_out_at, language_pref, snoozed_until";

/** Read: overdue open invoices, their customers and what was already sent, then plan today's reminders */
export async function loadOverdue(ctx: StepCtx): Promise<LoadOutput> {
  const s = chaserSettings(ctx.settings);
  const today = istDay(ctx.now);
  const since = new Date(ctx.now.getTime() - 400 * 86_400_000).toISOString();
  const [invoices, customers, history] = await Promise.all([
    ctx.db.select<InvoiceRow>("chaser_invoices", "id, customer_id, invoice_no, due_date, amount_total_minor, amount_paid_minor", { status: "open", due_date: { op: "lt", value: today } }),
    ctx.db.select<CustomerRow>("chaser_customers", CUSTOMER_COLS),
    ctx.db.select<ReminderRow>("chaser_reminders", "id, idempotency_key, customer_id, stage, anchor, status, sent_at, queued_at", { created_at: { op: "gte", value: since } }),
  ]);
  const startOfDay = istInstant(today).getTime();
  const sentToday = history.filter((h) => (h.status === "sent" || h.status === "queued") && Date.parse(h.sent_at ?? h.queued_at ?? "") >= startOfDay).length;

  const open: OpenInvoice[] = invoices.map((i) => ({ id: i.id, customerId: i.customer_id, invoiceNo: i.invoice_no, dueDate: i.due_date, outstandingMinor: i.amount_total_minor - i.amount_paid_minor }));
  const plan = planReminders({
    today,
    now: ctx.now,
    rules: rulesFrom(s, manifest.guardrails.maxMessagesPerContactPerDays.days),
    customers: customers.map(customerFrom),
    invoices: open,
    history: history.map((h) => ({ customerId: h.customer_id, stage: h.stage, anchor: h.anchor, status: h.status, at: h.sent_at ?? h.queued_at })),
    sentToday,
  });

  // A waiting reminder whose customer no longer owes anything overdue (paid, paused invoice, file
  // re-upload) is closed here, so it can never go out later
  const owing = new Set(open.filter((i) => i.outstandingMinor > 0).map((i) => i.customerId));
  if (!ctx.dryRun) {
    for (const h of history) {
      if ((h.status === "drafted" || h.status === "approved") && !owing.has(h.customer_id)) {
        await ctx.db.update("chaser_reminders", { status: "skipped", error: "Paid or closed before sending.", updated_at: ctx.now.toISOString() }, { id: h.id });
      }
    }
  }

  const names = new Map(customers.map((c) => [c.id, c]));
  for (const call of plan.personalCalls) {
    const c = names.get(call.customerId);
    if (!c) continue;
    await ctx.actions.enqueue({
      kind: "needs_personal_call",
      title: `Call ${c.name}`,
      body: `${formatMoney({ amount: call.totalMinor, currency: "INR" })} is ${call.daysOverdue} days overdue. Every reminder has gone out; a call usually works best now.`,
      payload: { customerId: c.id, phone: c.phone_e164 },
      ref: { type: "chaser_customer", id: c.id },
      idempotencyKey: ctx.idempotencyKey("call", c.id, call.anchor),
    });
  }

  const skipped: Record<string, number> = {};
  for (const sk of plan.skipped) skipped[sk.reason] = (skipped[sk.reason] ?? 0) + 1;
  if (plan.personalCalls.length) skipped.needs_personal_call = plan.personalCalls.length;
  ctx.log("info", "planned reminders", { items: plan.items.length, ...skipped });
  const people = new Set(open.map((i) => i.customerId)).size;
  ctx.say(open.length ? `Found ${n(open.length, "overdue invoice")} from ${n(people, "customer")}` : "No overdue invoices right now");
  if (plan.items.length) ctx.say(`${n(plan.items.length, "reminder")} due today`);
  const held = Object.entries(skipped).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${SKIP_WORDS[k] ?? k.replace(/_/g, " ")}`);
  if (held.length) ctx.say(`Held back: ${held.join(", ")}`);
  return { today, items: plan.items, skipped };
}
