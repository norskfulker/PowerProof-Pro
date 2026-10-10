import { describe, expect, it } from "vitest";
import { invoiceModel } from "./invoice-view";

const lines = [{ title: "Planner", unit: 50000, discount: 0, total: 50000, gift: false, hsn: "998433", rateBps: 1800 }, { title: "Pack", unit: 30000, discount: 0, total: 30000, gift: false, hsn: "998433", rateBps: 1800 }];
const base = { lines, buyerCountry: "IN", store: { gstin: "27ABCPR1234F1Z5" }, discount: 0, total: 80000 };

describe("invoice", () => {
  it("splits included GST out of each line for a registered seller selling to India", () => {
    const i = invoiceModel(base);
    expect(i.kind).toBe("igst");
    expect(i.total).toBe(80000);
    expect(i.taxable + i.tax).toBe(80000);
    expect(i.lines[0]).toMatchObject({ rate: 18, taxable: 42373, tax: 7627 });
  });
  it("charges no tax abroad or without a GSTIN", () => {
    expect(invoiceModel({ ...base, buyerCountry: "US" })).toMatchObject({ kind: "export", tax: 0, total: 80000 });
    expect(invoiceModel({ ...base, store: {} })).toMatchObject({ kind: "unregistered", tax: 0, total: 80000 });
  });
  it("always adds up to what was paid, even after a coupon", () => {
    const i = invoiceModel({ ...base, discount: 8000, total: 72000 });
    expect(i.total).toBe(72000);
    expect(i.lines.reduce((t, l) => t + l.total, 0)).toBe(72000);
    expect(i.taxable + i.tax).toBe(72000);
  });
  it("puts shipping on its own line at the main item's rate, and splits CGST/SGST inside the seller's state", () => {
    const goods = [{ title: "Tee", unit: 50000, discount: 0, total: 100000, gift: false, hsn: "6109", rateBps: 500, quantity: 2, variant: "M", physical: true }];
    const ship = { lines: goods, buyerCountry: "IN", store: { gstin: "27ABCPR1234F1Z5", address: "1 Road\n\nPune\nMaharashtra\n411001\nIndia" }, discount: 0, total: 105000, shipping: 5000, codFee: 0 };
    const other = invoiceModel({ ...ship, shipTo: { name: "A", phone: "1", line1: "x", city: "Delhi", state: "Delhi", pincode: "110001", country: "IN" } });
    expect(other.kind).toBe("igst");
    expect(other.lines.map((l) => l.title)).toEqual(["Tee (M) × 2", "Shipping"]);
    expect(other.lines[1]).toMatchObject({ total: 5000, rate: 5, hsn: "6109" });
    expect(other.total).toBe(105000);
    const same = invoiceModel({ ...ship, shipTo: { name: "A", phone: "1", line1: "x", city: "Pune", state: "Maharashtra", pincode: "411001", country: "IN" } });
    expect(same.kind).toBe("cgst_sgst");
    expect(invoiceModel({ ...ship, buyerCountry: "US", shipTo: { name: "A", phone: "1", line1: "x", city: "NY", pincode: "10001", country: "US" } }).note).toMatch(/Export of goods/);
  });
});
