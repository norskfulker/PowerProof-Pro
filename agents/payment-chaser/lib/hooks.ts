import { formatMoney } from "@/lib/money";
import { istDay, istInstant, istMonthStart } from "@/lib/agents/time";
import type { AgentHooks, StoreDb } from "@/lib/server/agents/runtime/types";
import { ingest } from "./ingest";
import { testMessage } from "./test-message";
import { overdue, paidAfterReminder, sentBetween, type StatInvoice, type StatReminder } from "./stats";

type InvoiceRow = { id: string; status: string; due_date: string; amount_total_minor: number; amount_paid_minor: number; paid_at: string | null };
type ReminderRow = { invoice_ids: string[]; channel: string; status: string; sent_at: string | null };

export async function loadStats(db: StoreDb, since: Date) {
  const [inv, rem] = await Promise.all([
    db.select<InvoiceRow>("chaser_invoices", "id, status, due_date, amount_total_minor, amount_paid_minor, paid_at"),
    db.select<ReminderRow>("chaser_reminders", "invoice_ids, channel, status, sent_at", { sent_at: { op: "gte", value: new Date(since.getTime() - 15 * 86_400_000).toISOString() } }),
  ]);
  const invoices: StatInvoice[] = inv.map((i) => ({ id: i.id, status: i.status, dueDate: i.due_date, totalMinor: Number(i.amount_total_minor), paidMinor: Number(i.amount_paid_minor), paidAt: i.paid_at }));
  const reminders: StatReminder[] = rem.map((r) => ({ invoiceIds: r.invoice_ids, channel: r.channel, status: r.status, sentAt: r.sent_at }));
  return { invoices, reminders };
}

export const chaserHooks: AgentHooks = {
  ingest,
  testMessage,

  async metrics(db, { now }) {
    const monthStart = istInstant(istMonthStart(now));
    const { invoices, reminders } = await loadStats(db, monthStart);
    return {
      overdue_total: overdue(invoices, istDay(now)).minor,
      paid_after_reminder_month: paidAfterReminder(invoices, reminders, monthStart, now).minor,
      reminders_sent: sentBetween(reminders, monthStart, now).total,
    };
  },

  async report(db, { periodStart, periodEnd, now }) {
    const from = istInstant(periodStart, 9);
    const to = istInstant(periodEnd, 9);
    const { invoices, reminders } = await loadStats(db, from);
    const [actions] = await Promise.all([db.select<{ kind: string }>("agent_action_items", "kind", { status: "open" })]);
    const due = overdue(invoices, istDay(now));
    const paid = paidAfterReminder(invoices, reminders, from, to);
    const sent = sentBetween(reminders, from, to);
    const data = {
      overdueMinor: due.minor,
      overdueCount: due.count,
      paidAfterReminderMinor: paid.minor,
      paidAfterReminderCount: paid.count,
      sentByChannel: sent.byChannel,
      sentTotal: sent.total,
      personalCalls: actions.filter((a) => a.kind === "needs_personal_call").length,
      whatsappWaiting: actions.filter((a) => a.kind === "whatsapp_send").length,
      periodStart,
      periodEnd,
    };
    return { subject: `Your week: ${formatMoney({ amount: paid.minor, currency: "INR" })} paid after reminders`, data, empty: due.count === 0 && sent.total === 0 && paid.count === 0 };
  },

  async onAction(db, item, outcome, now) {
    if (item.refType !== "chaser_reminder" || !item.refId) return;
    const at = now.toISOString();
    if (item.kind === "whatsapp_send") {
      await db.update("chaser_reminders", outcome === "done" ? { status: "sent", sent_at: at, error: null, updated_at: at } : { status: "skipped", error: "Skipped by you.", updated_at: at }, { id: item.refId });
    } else if (item.kind === "approve_draft" && outcome === "skipped") {
      await db.update("chaser_reminders", { status: "skipped", error: "Skipped by you.", updated_at: at }, { id: item.refId });
    }
  },
};
