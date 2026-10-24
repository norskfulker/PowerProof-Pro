import { describe, expect, it } from "vitest";
import { istInstant } from "@/lib/agents/time";
import { MemoryDb } from "@/lib/server/agents/runtime/memory";
import { testMessage } from "../lib/test-message";

const now = istInstant("2026-10-24", 11);
const settings = { tone: "friendly", language: "english", pay_details: "UPI test@upi" };

describe("payment chaser: send me a test email", () => {
  it("builds the oldest overdue customer's first reminder from real invoices", async () => {
    const db = new MemoryDb("store-a");
    db.seed("chaser_customers", [
      { id: "c1", name: "Later Traders" },
      { id: "c2", name: "Oldest Stores" },
    ]);
    db.seed("chaser_invoices", [
      { customer_id: "c1", invoice_no: "TEST-1", due_date: "2026-10-20", amount_total_minor: 100000, amount_paid_minor: 0, status: "open" },
      { customer_id: "c2", invoice_no: "TEST-2", due_date: "2026-10-01", amount_total_minor: 250000, amount_paid_minor: 50000, status: "open" },
      { customer_id: "c2", invoice_no: "TEST-3", due_date: "2026-09-01", amount_total_minor: 99900, amount_paid_minor: 99900, status: "paid" },
    ]);
    const m = await testMessage(db, { settings, businessName: "Demo Business", now });
    if ("missing" in m) throw new Error(m.missing);
    expect(m.about).toContain("Oldest Stores");
    expect(m.body).toContain("TEST-2");
    expect(m.body).toContain("₹2,000.00");
    expect(m.body).toContain("UPI test@upi");
    expect(m.body).not.toContain("TEST-3");
    expect(m.subject).toContain("Demo Business");
  });

  it("uses an invoice that isn't due yet when nothing is overdue", async () => {
    const db = new MemoryDb("store-a");
    db.seed("chaser_customers", [{ id: "c1", name: "Future Co" }]);
    db.seed("chaser_invoices", [{ customer_id: "c1", invoice_no: "TEST-9", due_date: "2026-10-26", amount_total_minor: 5000000, amount_paid_minor: 0, status: "open" }]);
    const m = await testMessage(db, { settings, businessName: "Demo Business", now });
    expect("missing" in m ? m.missing : m.body).toContain("TEST-9");
  });

  it("asks for an invoice when there is none", async () => {
    const m = await testMessage(new MemoryDb("store-a"), { settings, businessName: "Demo Business", now });
    expect(m).toEqual({ missing: expect.stringContaining("Add an invoice first") });
  });
});
