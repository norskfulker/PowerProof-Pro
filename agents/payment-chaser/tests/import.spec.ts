import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { MemoryDb, memoryId } from "@/lib/server/agents/runtime/memory";
import { saveInvoices } from "../lib/import";
import { detectMapping, parseSheet } from "../lib/parse";

const FILE_1 = `Invoice No,Customer,Mobile,Email,Amount,Due Date
TEST-1,Test Traders,9000000001,,"1,000",01/10/2026
TEST-2,Test Traders,9000000001,a@traders.example.test,"2,000",05/10/2026
TEST-3,Sample Stores,,s@sample.example.test,"3,000",07/10/2026`;

const FILE_2 = `Invoice No,Customer,Mobile,Amount,Balance,Due Date
TEST-1,Test Traders,9000000001,"1,000",0,01/10/2026
TEST-2,Test Traders,9000000001,"2,000","1,500",05/10/2026`;

async function load(db: MemoryDb, text: string) {
  const rows = parseCsv(text);
  const parsed = parseSheet(rows, detectMapping(rows[0]));
  return saveInvoices(db, { invoices: parsed.invoices, results: parsed.results, source: "csv", fileName: "dues.csv", isFull: true, now: new Date("2026-10-24T06:00:00Z"), newId: memoryId });
}

describe("payment chaser: saving an import", () => {
  it("creates customers once and groups invoices under them", async () => {
    const db = new MemoryDb("store-a");
    const s = await load(db, FILE_1);
    expect(s).toMatchObject({ imported: 3, updated: 0, failed: 0 });
    const customers = db.rows("chaser_customers");
    expect(customers.map((c) => c.name).sort()).toEqual(["Sample Stores", "Test Traders"]);
    // The second row filled in the email the first row didn't have
    expect(customers.find((c) => c.name === "Test Traders")).toMatchObject({ phone_e164: "+919000000001", email: "a@traders.example.test" });
  });

  it("re-upload updates, marks fully paid ones paid, and asks about the missing one", async () => {
    const db = new MemoryDb("store-a");
    await load(db, FILE_1);
    const s = await load(db, FILE_2);
    expect(s).toMatchObject({ imported: 0, updated: 2, markedPaid: 1 });
    const inv = db.rows("chaser_invoices");
    expect(inv.find((i) => i.invoice_no === "TEST-1")).toMatchObject({ status: "paid" });
    expect(inv.find((i) => i.invoice_no === "TEST-2")).toMatchObject({ status: "open", amount_paid_minor: 50000 });
    // TEST-3 vanished from the file: not marked paid, listed for the owner instead
    expect(inv.find((i) => i.invoice_no === "TEST-3")).toMatchObject({ status: "open" });
    expect(s.missing.map((m) => m.invoiceNo)).toEqual(["TEST-3"]);
    expect(db.rows("chaser_customers")).toHaveLength(2);
  });

  it("keeps the owner's own status (paused, disputed) on re-upload", async () => {
    const db = new MemoryDb("store-a");
    await load(db, FILE_1);
    Object.assign(db.rows("chaser_invoices").find((i) => i.invoice_no === "TEST-2")!, { status: "disputed" });
    await load(db, FILE_1);
    expect(db.rows("chaser_invoices").find((i) => i.invoice_no === "TEST-2")?.status).toBe("disputed");
  });
});
