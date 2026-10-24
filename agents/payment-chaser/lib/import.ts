import type { StoreDb } from "@/lib/server/agents/runtime/types";
import type { ParsedInvoice, RowResult } from "./parse";

/**
 * Saves parsed invoices for one store. Customers are matched by mobile, then email, then name;
 * invoices are upserted by invoice number. An invoice that disappears from a newer full upload is
 * NOT marked paid: its id is kept on the import so the owner can confirm. An invoice the file shows
 * as fully paid is marked paid (and its reminders stop). Same code for CSV, Excel, Sheets and manual.
 */

export interface ImportSummary {
  importId: string | null;
  total: number;
  imported: number;
  updated: number;
  failed: number;
  markedPaid: number;
  missing: { id: string; invoiceNo: string; customer: string; outstandingMinor: number }[];
  problems: { row: number; reason: string }[];
  warnings: { row: number; warning: string }[];
}

type CustomerRow = { id: string; name: string; phone_e164: string | null; email: string | null };
type InvoiceRow = { id: string; invoice_no: string; status: string; customer_id: string; amount_total_minor: number; amount_paid_minor: number };

const key = (s: string) => s.trim().toLowerCase();

export async function saveInvoices(
  db: StoreDb,
  o: { invoices: ParsedInvoice[]; results?: RowResult[]; source: "csv" | "xlsx" | "sheet" | "manual"; fileName?: string; isFull: boolean; now: Date; userId?: string | null; newId: () => string }
): Promise<ImportSummary> {
  const nowIso = o.now.toISOString();
  const customers = await db.select<CustomerRow>("chaser_customers", "id, name, phone_e164, email");
  const byPhone = new Map(customers.filter((c) => c.phone_e164).map((c) => [c.phone_e164!, c]));
  const byEmail = new Map(customers.filter((c) => c.email).map((c) => [key(c.email!), c]));
  const byName = new Map(customers.map((c) => [key(c.name), c]));

  const newCustomers: Record<string, unknown>[] = [];
  const customerPatches: { id: string; patch: Record<string, unknown> }[] = [];
  const customerFor = (inv: ParsedInvoice): string => {
    let c = (inv.phone && byPhone.get(inv.phone)) || (inv.email && byEmail.get(key(inv.email))) || byName.get(key(inv.customerName));
    if (!c) {
      c = { id: o.newId(), name: inv.customerName, phone_e164: inv.phone, email: inv.email };
      newCustomers.push({ id: c.id, name: c.name, phone_e164: c.phone_e164, email: c.email });
    } else {
      // Fill in a contact the customer didn't have yet (never overwrite one the owner set)
      const patch: Record<string, unknown> = {};
      if (!c.phone_e164 && inv.phone && !byPhone.has(inv.phone)) patch.phone_e164 = c.phone_e164 = inv.phone;
      if (!c.email && inv.email) patch.email = c.email = inv.email;
      if (Object.keys(patch).length) {
        const fresh = newCustomers.find((n) => n.id === c!.id);
        if (fresh) Object.assign(fresh, patch);
        else customerPatches.push({ id: c.id, patch: { ...patch, updated_at: nowIso } });
      }
    }
    if (c.phone_e164) byPhone.set(c.phone_e164, c);
    if (c.email) byEmail.set(key(c.email), c);
    byName.set(key(c.name), c);
    return c.id;
  };

  const existing = await db.select<InvoiceRow>("chaser_invoices", "id, invoice_no, status, customer_id, amount_total_minor, amount_paid_minor");
  const existingByNo = new Map(existing.map((i) => [key(i.invoice_no), i]));
  const seen = new Set<string>();
  const importId = o.newId();
  const rows: Record<string, unknown>[] = [];
  let imported = 0;
  let updated = 0;
  let markedPaid = 0;

  for (const inv of o.invoices) {
    const k = key(inv.invoiceNo);
    seen.add(k);
    const prev = existingByNo.get(k);
    const fullyPaid = inv.amountPaidMinor >= inv.amountTotalMinor;
    // The owner's own status choices stay (paused, disputed, written off, paid); the file can only mark paid
    const status = prev && prev.status !== "open" ? prev.status : fullyPaid ? "paid" : "open";
    if (prev?.status === "open" && fullyPaid) markedPaid++;
    rows.push({
      id: prev?.id ?? o.newId(),
      customer_id: customerFor(inv),
      invoice_no: inv.invoiceNo,
      invoice_date: inv.invoiceDate,
      due_date: inv.dueDate,
      amount_total_minor: inv.amountTotalMinor,
      amount_paid_minor: Math.min(inv.amountPaidMinor, inv.amountTotalMinor),
      status,
      paid_at: status === "paid" && prev?.status !== "paid" ? nowIso : undefined,
      source: o.source,
      import_id: importId,
      updated_at: nowIso,
    });
    if (prev) updated++;
    else imported++;
  }

  const missing = o.isFull ? existing.filter((i) => i.status === "open" && !seen.has(key(i.invoice_no))) : [];
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const failed = (o.results ?? []).filter((r) => !r.ok) as Extract<RowResult, { ok: false }>[];
  const warned = (o.results ?? []).filter((r): r is Extract<RowResult, { ok: true }> => r.ok && r.warnings.length > 0);

  await db.insert("chaser_imports", [
    {
      id: importId,
      file_name: (o.fileName ?? "").slice(0, 200),
      source: o.source,
      rows_total: o.results?.length ?? o.invoices.length,
      rows_imported: imported,
      rows_updated: updated,
      rows_failed: failed.length,
      error_report: [...failed.map((f) => ({ row: f.row, reason: f.reason })), ...warned.flatMap((w) => w.warnings.map((warning) => ({ row: w.row, warning })))].slice(0, 2000),
      missing_invoice_ids: missing.map((m) => m.id),
      is_full: o.isFull,
      status: missing.length ? "open" : "done",
      created_by: o.userId ?? null,
    },
  ]);
  for (let i = 0; i < newCustomers.length; i += 500) await db.insert("chaser_customers", newCustomers.slice(i, i + 500));
  for (const p of customerPatches) await db.update("chaser_customers", p.patch, { id: p.id });
  // Strip undefined so an upsert never clears paid_at on rows that keep their status
  const clean = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)));
  for (let i = 0; i < clean.length; i += 500) await db.upsert("chaser_invoices", clean.slice(i, i + 500), "store_id,invoice_no");

  return {
    importId,
    total: o.results?.length ?? o.invoices.length,
    imported,
    updated,
    failed: failed.length,
    markedPaid,
    missing: missing.map((m) => ({ id: m.id, invoiceNo: m.invoice_no, customer: names.get(m.customer_id) ?? "", outstandingMinor: m.amount_total_minor - m.amount_paid_minor })),
    problems: failed.map((f) => ({ row: f.row, reason: f.reason })),
    warnings: warned.flatMap((w) => w.warnings.map((warning) => ({ row: w.row, warning }))),
  };
}
