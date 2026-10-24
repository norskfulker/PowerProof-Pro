import { daysBetween } from "@/lib/agents/time";

/**
 * The numbers on the Payment Chaser screens and in the weekly report, worked out the same way
 * everywhere. "Paid after a reminder" = an invoice marked paid within 14 days after at least one
 * reminder for it went out. Never "recovered by us".
 */

export const PAID_AFTER_REMINDER_DAYS = 14;

export interface StatInvoice {
  id: string;
  status: string;
  dueDate: string;
  totalMinor: number;
  paidMinor: number;
  paidAt: string | null;
}

export interface StatReminder {
  invoiceIds: string[];
  channel: string;
  status: string;
  sentAt: string | null;
}

export const AGING = [
  { key: "d1_7", label: "1–7 days", min: 1, max: 7 },
  { key: "d8_30", label: "8–30 days", min: 8, max: 30 },
  { key: "d31_60", label: "31–60 days", min: 31, max: 60 },
  { key: "d60_plus", label: "60+ days", min: 61, max: Infinity },
] as const;

export function overdue(invoices: StatInvoice[], today: string) {
  const open = invoices.filter((i) => i.status === "open" && i.totalMinor > i.paidMinor && daysBetween(i.dueDate, today) >= 1);
  const buckets = AGING.map((b) => {
    const inB = open.filter((i) => {
      const d = daysBetween(i.dueDate, today);
      return d >= b.min && d <= b.max;
    });
    return { key: b.key, label: b.label, count: inB.length, minor: inB.reduce((n, i) => n + i.totalMinor - i.paidMinor, 0) };
  });
  return { count: open.length, minor: open.reduce((n, i) => n + i.totalMinor - i.paidMinor, 0), buckets };
}

/** Invoices paid in [from, to) within 14 days after a reminder that included them */
export function paidAfterReminder(invoices: StatInvoice[], reminders: StatReminder[], from: Date, to: Date) {
  const firstSent = new Map<string, number[]>();
  for (const r of reminders) {
    if (r.status !== "sent" || !r.sentAt) continue;
    for (const id of r.invoiceIds) firstSent.set(id, [...(firstSent.get(id) ?? []), Date.parse(r.sentAt)]);
  }
  const hits = invoices.filter((i) => {
    if (i.status !== "paid" || !i.paidAt) return false;
    const paid = Date.parse(i.paidAt);
    if (paid < from.getTime() || paid >= to.getTime()) return false;
    return (firstSent.get(i.id) ?? []).some((s) => s <= paid && paid - s <= PAID_AFTER_REMINDER_DAYS * 86_400_000);
  });
  return { count: hits.length, minor: hits.reduce((n, i) => n + i.totalMinor, 0) };
}

export function sentBetween(reminders: StatReminder[], from: Date, to: Date) {
  const by: Record<string, number> = {};
  for (const r of reminders) {
    if (r.status !== "sent" || !r.sentAt) continue;
    const t = Date.parse(r.sentAt);
    if (t >= from.getTime() && t < to.getTime()) by[r.channel] = (by[r.channel] ?? 0) + 1;
  }
  return { total: Object.values(by).reduce((a, b) => a + b, 0), byChannel: by };
}
