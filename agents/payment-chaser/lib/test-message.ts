import { istDay } from "@/lib/agents/time";
import type { AgentHooks } from "@/lib/server/agents/runtime/types";
import { staticTemplate } from "../templates";
import { toneFor } from "./plan";
import { chaserSettings, factsFor, render } from "./render";

type InvoiceRow = { customer_id: string; invoice_no: string; due_date: string; amount_total_minor: number; amount_paid_minor: number };

/**
 * "Send me a test email": the first reminder one real customer would get, built from the store's
 * own invoices and settings (oldest overdue customer first, else any open invoice). Static wording,
 * so it's instant and free; the real runs may word it with AI.
 */
export const testMessage: NonNullable<AgentHooks["testMessage"]> = async (db, o) => {
  const s = chaserSettings(o.settings);
  const today = istDay(o.now);
  const open = (await db.select<InvoiceRow>("chaser_invoices", "customer_id, invoice_no, due_date, amount_total_minor, amount_paid_minor", { status: "open" }, { order: { column: "due_date" } })).filter((i) => i.amount_total_minor > i.amount_paid_minor);
  if (!open.length) return { missing: "Add an invoice first: the test uses one of your real invoices." };
  const overdue = open.filter((i) => i.due_date < today);
  const customerId = (overdue[0] ?? open[0]).customer_id;
  const theirs = (overdue.length ? overdue : open).filter((i) => i.customer_id === customerId);
  const [customer] = await db.select<{ name: string }>("chaser_customers", "name", { id: customerId });
  const facts = factsFor({
    customerName: customer?.name ?? "",
    invoices: theirs.map((i) => ({ invoiceNo: i.invoice_no, dueDate: i.due_date, outstandingMinor: i.amount_total_minor - i.amount_paid_minor })),
    businessName: s.sender_name || o.businessName,
    payDetails: s.pay_details,
    today,
  });
  const filled = render(staticTemplate(1, toneFor(1, s.tone), s.language, "email"), facts);
  return { subject: filled.subject ?? "Payment reminder", body: filled.body, about: `the first reminder ${facts.customer_name} would get` };
};
