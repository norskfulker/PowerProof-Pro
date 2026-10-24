import { checkWording, describeProblem, forbiddenPhraseIn } from "@/lib/agents/guardrails";
import { istDay } from "@/lib/agents/time";
import type { StoreDb } from "@/lib/server/agents/runtime/types";
import manifest from "../manifest";
import { saveInvoices } from "./import";
import { normalizeEmail, normalizePhone, parseAmountMinor, parseDate, safeCell } from "./parse";
import { chaserSettings, factsFor } from "./render";

/**
 * What the owner does by hand. Paid stops reminders at once: waiting drafts are closed and queued
 * WhatsApp items are taken off the queue (their credit comes back through the caller).
 */

export class OwnerError extends Error {}

type ReminderRow = { id: string; invoice_ids: string[]; status: string; customer_id: string };

/** Marks invoices paid; returns the outbox ids of queued WhatsApp messages to cancel */
export async function markPaid(db: StoreDb, invoiceIds: string[], now: Date): Promise<{ cancelledOutbox: string[] }> {
  if (!invoiceIds.length) return { cancelledOutbox: [] };
  const at = now.toISOString();
  const inv = await db.select<{ id: string; amount_total_minor: number; status: string }>("chaser_invoices", "id, amount_total_minor, status", { id: invoiceIds });
  for (const i of inv) {
    if (i.status === "paid") continue;
    await db.update("chaser_invoices", { status: "paid", amount_paid_minor: i.amount_total_minor, paid_at: at, updated_at: at }, { id: i.id });
  }
  return closeStaleReminders(db, now);
}

/** Closes waiting reminders whose invoices are all closed now; returns queued WhatsApp outbox ids to cancel */
export async function closeStaleReminders(db: StoreDb, now: Date): Promise<{ cancelledOutbox: string[] }> {
  const at = now.toISOString();
  const waiting = await db.select<ReminderRow & { provider_message_id: string | null }>("chaser_reminders", "id, invoice_ids, status, customer_id, provider_message_id", { status: ["drafted", "approved", "queued", "snoozed"] });
  if (!waiting.length) return { cancelledOutbox: [] };
  const open = new Set((await db.select<{ id: string }>("chaser_invoices", "id", { status: "open" })).map((i) => i.id));
  const cancelled: string[] = [];
  for (const r of waiting) {
    if (r.invoice_ids.some((id) => open.has(id))) continue;
    await db.update("chaser_reminders", { status: "skipped", error: "Paid before sending.", updated_at: at }, { id: r.id });
    await db.update("agent_action_items", { status: "skipped", done_at: at }, { ref_id: r.id, status: ["open", "snoozed"] });
    if (r.status === "queued" && r.provider_message_id) cancelled.push(r.provider_message_id);
  }
  return { cancelledOutbox: cancelled };
}

export async function setInvoiceStatus(db: StoreDb, ids: string[], status: "open" | "paused" | "disputed" | "written_off", now: Date) {
  const at = now.toISOString();
  for (const id of ids) await db.update("chaser_invoices", { status, paid_at: null, updated_at: at }, { id });
  return status === "open" ? { cancelledOutbox: [] } : closeStaleReminders(db, now);
}

export interface ManualInvoice {
  customerName: string;
  phone?: string;
  email?: string;
  invoiceNo: string;
  amount: string;
  paid?: string;
  dueDate: string;
  invoiceDate?: string;
}

export async function addInvoice(db: StoreDb, m: ManualInvoice, now: Date, newId: () => string, userId?: string) {
  const total = parseAmountMinor(m.amount);
  const paid = m.paid ? parseAmountMinor(m.paid) : 0;
  const due = parseDate(m.dueDate);
  if (!m.customerName.trim()) throw new OwnerError("Add the customer's name.");
  if (!m.invoiceNo.trim()) throw new OwnerError("Add the invoice number.");
  if (total === null || total <= 0) throw new OwnerError("Type the amount, like 25,000.");
  if (paid === null || paid > total) throw new OwnerError("Paid can't be more than the amount.");
  if (!due) throw new OwnerError("Pick the due date.");
  const phone = m.phone ? normalizePhone(m.phone) : null;
  if (m.phone && !phone) throw new OwnerError("That mobile number doesn't look right.");
  const email = m.email ? normalizeEmail(m.email) : null;
  if (m.email && !email) throw new OwnerError("That email doesn't look right.");
  return saveInvoices(db, {
    invoices: [{ invoiceNo: m.invoiceNo.trim().slice(0, 60), customerName: m.customerName.trim().slice(0, 120), phone, email, amountTotalMinor: total, amountPaidMinor: paid, invoiceDate: m.invoiceDate ? parseDate(m.invoiceDate) : null, dueDate: due }],
    source: "manual",
    isFull: false,
    now,
    newId,
    userId,
  });
}

/** The owner rewrites a reminder. Any wording is theirs, but the forbidden-phrase and length checks still apply. */
export async function editReminder(db: StoreDb, id: string, subject: string | null, body: string, now: Date) {
  const [r] = await db.select<{ channel: "email" | "whatsapp" | "sms"; status: string }>("chaser_reminders", "channel, status", { id });
  if (!r) throw new OwnerError("That reminder wasn't found.");
  if (!["drafted", "approved", "snoozed"].includes(r.status)) throw new OwnerError("This reminder has already gone out.");
  const max = r.channel === "email" ? 1500 : 700;
  const text = body.trim();
  if (!text) throw new OwnerError("The message is empty.");
  if (text.length > max) throw new OwnerError(`Keep it under ${max} characters.`);
  const phrase = forbiddenPhraseIn(`${subject ?? ""} ${text}`, manifest.guardrails.forbiddenPhrases);
  if (phrase) throw new OwnerError(`“${phrase}” isn't allowed in reminders: they must never sound like a threat.`);
  await db.update("chaser_reminders", { subject: r.channel === "email" ? (subject ?? "").trim().slice(0, 150) || null : null, body: text, edited: true, source: "owner", updated_at: now.toISOString() }, { id });
}

/** After the amounts changed under an edited reminder, the owner looks again and approves it */
export async function approveReminder(db: StoreDb, id: string, settings: Record<string, unknown>, businessName: string, now: Date) {
  const [r] = await db.select<ReminderRow & { channel: string }>("chaser_reminders", "id, invoice_ids, status, customer_id, channel", { id });
  if (!r) throw new OwnerError("That reminder wasn't found.");
  const [c] = await db.select<{ name: string }>("chaser_customers", "name", { id: r.customer_id });
  const inv = await db.select<{ invoice_no: string; due_date: string; amount_total_minor: number; amount_paid_minor: number; status: string }>("chaser_invoices", "invoice_no, due_date, amount_total_minor, amount_paid_minor, status", { id: r.invoice_ids });
  const open = inv.filter((i) => i.status === "open" && i.amount_total_minor > i.amount_paid_minor);
  if (!open.length) throw new OwnerError("Everything in this reminder is already paid.");
  const s = chaserSettings(settings);
  const facts = factsFor({ customerName: c?.name ?? "", invoices: open.map((i) => ({ invoiceNo: i.invoice_no, dueDate: i.due_date, outstandingMinor: i.amount_total_minor - i.amount_paid_minor })), businessName: s.sender_name || businessName, payDetails: s.pay_details, today: istDay(now) });
  await db.update("chaser_reminders", { status: "approved", facts, error: null, scheduled_for: now.toISOString(), updated_at: now.toISOString() }, { id });
  await db.update("agent_action_items", { status: "done", done_at: now.toISOString() }, { ref_id: id, kind: "approve_draft", status: ["open", "snoozed"] });
}

/** Checks the owner's draft the way the model's is checked, for the editor's live hints */
export function hintFor(body: string, channel: "email" | "whatsapp" | "sms"): string | null {
  const p = checkWording(body, { required: [], allowed: [], maxChars: channel === "email" ? 1500 : 700, forbidden: manifest.guardrails.forbiddenPhrases });
  return p && p.code !== "has_digits" && p.code !== "unknown_placeholder" ? describeProblem(p) : null;
}

/** Customers and invoices as CSV rows, safe to open in a spreadsheet */
export async function exportRows(db: StoreDb): Promise<string[][]> {
  const [cust, inv] = await Promise.all([
    db.select<{ id: string; name: string; phone_e164: string | null; email: string | null; is_paused: boolean; opted_out_at: string | null }>("chaser_customers", "id, name, phone_e164, email, is_paused, opted_out_at"),
    db.select<{ customer_id: string; invoice_no: string; invoice_date: string | null; due_date: string; amount_total_minor: number; amount_paid_minor: number; status: string; paid_at: string | null }>("chaser_invoices", "customer_id, invoice_no, invoice_date, due_date, amount_total_minor, amount_paid_minor, status, paid_at"),
  ]);
  const byId = new Map(cust.map((c) => [c.id, c]));
  const rupees = (m: number) => (m / 100).toFixed(2);
  return [
    ["Invoice number", "Customer", "Mobile", "Email", "Invoice date", "Due date", "Amount (INR)", "Paid (INR)", "Status", "Paid on", "Customer paused", "Opted out"],
    ...inv.map((i) => {
      const c = byId.get(i.customer_id);
      return [i.invoice_no, c?.name ?? "", c?.phone_e164 ?? "", c?.email ?? "", i.invoice_date ?? "", i.due_date, rupees(Number(i.amount_total_minor)), rupees(Number(i.amount_paid_minor)), i.status, i.paid_at ? istDay(new Date(i.paid_at)) : "", c?.is_paused ? "yes" : "no", c?.opted_out_at ? "yes" : "no"].map(safeCell);
    }),
  ];
}
