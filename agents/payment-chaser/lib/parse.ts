/**
 * Reading an invoice file the way Indian small businesses write them: "₹1,25,000.50", "Rs 500/-",
 * dates as DD/MM/YYYY, DD-MM-YY or Excel serials, phones with or without +91. Runs in the browser
 * (preview and column mapping) and on the server (which checks every row again).
 */

export const FIELDS = ["invoice_no", "customer_name", "phone", "email", "amount_total", "amount_outstanding", "amount_paid", "invoice_date", "due_date"] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Partial<Record<Field, number>>;

export const FIELD_LABELS: Record<Field, string> = {
  invoice_no: "Invoice number",
  customer_name: "Customer name",
  phone: "Mobile",
  email: "Email",
  amount_total: "Invoice amount",
  amount_outstanding: "Amount pending",
  amount_paid: "Amount paid",
  invoice_date: "Invoice date",
  due_date: "Due date",
};

const SYNONYMS: Record<Field, string[]> = {
  invoice_no: ["invoice no", "invoice number", "invoice", "inv no", "inv", "invoice id", "bill no", "bill number", "bill", "voucher no", "voucher number", "ref no", "reference"],
  customer_name: ["party", "party name", "customer", "customer name", "client", "client name", "name", "buyer", "debtor", "account name", "ledger"],
  phone: ["mobile", "mobile no", "mobile number", "phone", "phone no", "phone number", "contact", "contact no", "contact number", "whatsapp", "whatsapp no", "cell"],
  email: ["email", "e mail", "email id", "mail", "mail id"],
  amount_total: ["amount", "invoice amount", "bill amount", "total", "total amount", "net amount", "grand total", "invoice value"],
  amount_outstanding: ["balance", "balance amount", "outstanding", "outstanding amount", "pending", "pending amount", "due amount", "amount due", "receivable", "closing balance"],
  amount_paid: ["paid", "amount paid", "received", "amount received", "paid amount"],
  invoice_date: ["invoice date", "bill date", "date", "inv date", "voucher date"],
  due_date: ["due date", "due on", "due", "payment due", "due by", "pay by"],
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\b(rs|inr)\b/g, "").trim();

/** Matches headers to fields (exact synonym first, then "starts with"), each column used once */
export function detectMapping(headers: string[]): Mapping {
  const out: Mapping = {};
  const used = new Set<number>();
  const H = headers.map(norm);
  for (const pass of ["exact", "prefix"] as const) {
    for (const f of FIELDS) {
      if (out[f] !== undefined) continue;
      const i = H.findIndex((h, idx) => !used.has(idx) && h !== "" && SYNONYMS[f].some((s) => (pass === "exact" ? h === s : h.startsWith(`${s} `))));
      if (i >= 0) {
        out[f] = i;
        used.add(i);
      }
    }
  }
  return out;
}

/** What the import needs before it can run */
export function mappingProblems(m: Mapping): string[] {
  const p: string[] = [];
  if (m.invoice_no === undefined) p.push("Pick the column with invoice numbers.");
  if (m.customer_name === undefined) p.push("Pick the column with customer names.");
  if (m.amount_total === undefined && m.amount_outstanding === undefined) p.push("Pick the column with the amount.");
  if (m.due_date === undefined && m.invoice_date === undefined) p.push("Pick the due date column (or the invoice date).");
  return p;
}

/** "₹1,25,000.50" → 12500050 paise. Negative, blank or unreadable → null */
export function parseAmountMinor(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null;
  const s = raw
    .trim()
    .replace(/^(₹|rs\.?|inr)\s*/i, "")
    .replace(/\/-$/, "")
    .replace(/\s*(₹|rs\.?|inr)$/i, "")
    .replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const v = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(v) ? v : null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

function ymd(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d > days ? null : `${y}-${pad(m)}-${pad(d)}`;
}

/** DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY, YYYY-MM-DD, "05 Mar 2026", "5-Mar-26" or an Excel serial → "YYYY-MM-DD" */
export function parseDate(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Excel stores dates as days since 30 Dec 1899
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial < 32874 || serial > 73051) return null; // 1990..2099
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return ymd(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[\s-]+([a-z]{3,4})[a-z]*[\s,-]+(\d{2}|\d{4})$/i);
  if (m && MONTHS[m[2].toLowerCase()]) return ymd(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}

/** Indian mobile or landline to E.164; numbers with a + keep their country. Unreadable → null */
export function normalizePhone(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const plus = s.startsWith("+") || s.startsWith("00");
  let d = s.replace(/\D/g, "");
  if (s.startsWith("00")) d = d.slice(2);
  if (plus) return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null;
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;
export const normalizeEmail = (raw: string | null | undefined) => {
  const e = (raw ?? "").trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : null;
};

export interface ParsedInvoice {
  invoiceNo: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  amountTotalMinor: number;
  amountPaidMinor: number;
  invoiceDate: string | null;
  dueDate: string;
}

export type RowResult = { row: number; ok: true; invoice: ParsedInvoice; warnings: string[] } | { row: number; ok: false; reason: string };

const clean = (v: string | undefined, max: number) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** One spreadsheet row (1-based `row` as the owner sees it) to an invoice, or the reason it was skipped */
export function parseRow(cells: string[], m: Mapping, row: number): RowResult {
  const get = (f: Field) => (m[f] === undefined ? "" : (cells[m[f]!] ?? ""));
  const invoiceNo = clean(get("invoice_no"), 60);
  const customerName = clean(get("customer_name"), 120);
  if (!invoiceNo) return { row, ok: false, reason: "No invoice number." };
  if (!customerName) return { row, ok: false, reason: "No customer name." };

  const total = get("amount_total") ? parseAmountMinor(get("amount_total")) : null;
  const outstanding = get("amount_outstanding") ? parseAmountMinor(get("amount_outstanding")) : null;
  const paidRaw = get("amount_paid") ? parseAmountMinor(get("amount_paid")) : null;
  if (get("amount_total") && total === null) return { row, ok: false, reason: `Couldn't read the amount “${clean(get("amount_total"), 30)}”.` };
  if (get("amount_outstanding") && outstanding === null) return { row, ok: false, reason: `Couldn't read the pending amount “${clean(get("amount_outstanding"), 30)}”.` };
  const amountTotalMinor = total ?? outstanding;
  if (amountTotalMinor === null) return { row, ok: false, reason: "No amount." };
  const amountPaidMinor = paidRaw ?? (total !== null && outstanding !== null ? Math.max(0, total - outstanding) : 0);
  if (amountPaidMinor > amountTotalMinor) return { row, ok: false, reason: "Paid is more than the invoice amount." };

  const warnings: string[] = [];
  const invoiceDate = get("invoice_date") ? parseDate(get("invoice_date")) : null;
  if (get("invoice_date") && !invoiceDate) warnings.push(`Couldn't read the invoice date “${clean(get("invoice_date"), 20)}”.`);
  let dueDate = get("due_date") ? parseDate(get("due_date")) : null;
  if (get("due_date") && !dueDate) return { row, ok: false, reason: `Couldn't read the due date “${clean(get("due_date"), 20)}”. Use DD/MM/YYYY.` };
  if (!dueDate) {
    if (!invoiceDate) return { row, ok: false, reason: "No due date." };
    dueDate = invoiceDate;
    warnings.push("No due date, so the invoice date is used.");
  }

  const phone = normalizePhone(get("phone"));
  const email = normalizeEmail(get("email"));
  if (get("phone") && !phone) warnings.push(`Mobile “${clean(get("phone"), 20)}” doesn't look right.`);
  if (!phone && !email) warnings.push("Missing contact.");
  return { row, ok: true, invoice: { invoiceNo, customerName, phone, email, amountTotalMinor, amountPaidMinor, invoiceDate, dueDate }, warnings };
}

export const MAX_ROWS = 5000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** All rows of a sheet (first row = headers). Later rows win when an invoice number repeats. */
export function parseSheet(rows: string[][], m: Mapping): { results: RowResult[]; invoices: ParsedInvoice[]; duplicates: number } {
  const body = rows.slice(1, MAX_ROWS + 1);
  const results = body.map((cells, i) => parseRow(cells, m, i + 2));
  const byNo = new Map<string, ParsedInvoice>();
  let duplicates = 0;
  for (const r of results) {
    if (!r.ok) continue;
    const key = r.invoice.invoiceNo.toLowerCase();
    if (byNo.has(key)) duplicates++;
    byNo.set(key, r.invoice);
  }
  return { results, invoices: [...byNo.values()], duplicates };
}

/** Spreadsheet-safe cell for exports: a leading = + - @ (or tab/CR) can't run as a formula */
export const safeCell = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
