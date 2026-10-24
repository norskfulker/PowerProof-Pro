import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { detectMapping, mappingProblems, normalizePhone, parseAmountMinor, parseDate, parseSheet, safeCell } from "../lib/parse";

/** A messy, made-up file the way small businesses export from Tally or Excel */
const MESSY = `Bill No.,Party Name,Mobile No,E-mail,Bill Amount (Rs),Balance,Bill Date,Due On
INV/001,Test Traders,98765 43210,,"₹1,25,000.50","1,25,000.50",01/09/2026,15/09/2026
INV/002,Sample Stores,+91-91234-56789,accounts@sample.test,"Rs 50,000/-","20,000",05-09-26,20-09-26
INV/003,Demo & Co,0 8123456789,,"2,500","2,500",10 Sep 2026,46300
INV/004,,9000000000,,100,100,01/09/2026,01/10/2026
INV/005,No Contact Ltd,12345,,abc,,01/09/2026,31/09/2026
INV/001,Test Traders,9876543210,,"1,25,000.50","1,00,000.50",01/09/2026,15/09/2026`;

describe("payment chaser: reading invoice files", () => {
  it("finds columns from Indian headers", () => {
    const m = detectMapping(parseCsv(MESSY)[0]);
    expect(m).toEqual({ invoice_no: 0, customer_name: 1, phone: 2, email: 3, amount_total: 4, amount_outstanding: 5, invoice_date: 6, due_date: 7 });
    expect(mappingProblems(m)).toEqual([]);
    expect(mappingProblems({})).toHaveLength(4);
  });

  it("reads Indian amounts into paise", () => {
    expect(parseAmountMinor("₹1,25,000.50")).toBe(12500050);
    expect(parseAmountMinor("Rs. 50,000/-")).toBe(5000000);
    expect(parseAmountMinor("1250.5")).toBe(125050);
    expect(parseAmountMinor(125000.5)).toBe(12500050);
    expect(parseAmountMinor("-500")).toBeNull();
    expect(parseAmountMinor("12.345")).toBeNull();
  });

  it("reads Indian dates and Excel serials", () => {
    expect(parseDate("15/09/2026")).toBe("2026-09-15");
    expect(parseDate("05-09-26")).toBe("2026-09-05");
    expect(parseDate("10 Sep 2026")).toBe("2026-09-10");
    expect(parseDate("5-Sept-26")).toBe("2026-09-05");
    expect(parseDate("46300")).toBe("2026-10-05");
    expect(parseDate("31/09/2026")).toBeNull();
    expect(parseDate("2026-09-15")).toBe("2026-09-15");
  });

  it("normalises phones to +91", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+91-91234-56789")).toBe("+919123456789");
    expect(normalizePhone("0 8123456789")).toBe("+918123456789");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("12345")).toBeNull();
  });

  it("imports the messy file with row-level reasons and totals that match a hand count", () => {
    const rows = parseCsv(MESSY);
    const { results, invoices, duplicates } = parseSheet(rows, detectMapping(rows[0]));
    const skipped = results.filter((r) => !r.ok);
    expect(skipped.map((r) => (r.ok ? 0 : r.row))).toEqual([5, 6]);
    expect(skipped[0]).toMatchObject({ reason: "No customer name." });
    expect(duplicates).toBe(1);
    expect(invoices).toHaveLength(3);
    // Hand count: INV/001 last row wins: 1,25,000.50 billed, 1,00,000.50 pending → 25,000 paid
    const inv1 = invoices.find((i) => i.invoiceNo === "INV/001")!;
    expect(inv1).toMatchObject({ amountTotalMinor: 12500050, amountPaidMinor: 2500000, dueDate: "2026-09-15", phone: "+919876543210" });
    const pending = invoices.reduce((n, i) => n + i.amountTotalMinor - i.amountPaidMinor, 0);
    expect(pending).toBe(10000050 + 2000000 + 250000); // ₹1,22,500.50
  });

  it("keeps formulas out of exports", () => {
    expect(safeCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeCell("Test Traders")).toBe("Test Traders");
  });
});
