import { money } from "./money";
import type { Company, Money, Order, TaxCode } from "./types";

export interface InvoiceTax {
  kind: "intra" | "inter" | "export" | "unregistered";
  taxable: Money;
  cgst: Money;
  sgst: Money;
  igst: Money;
  total: Money;
  rate: number;
  note: string;
}

/**
 * GST split for a digital sale. Prices include tax. Same state → CGST+SGST, other state →
 * IGST, outside India → export of services (zero-rated under LUT). Not registered → no GST.
 * Founder to confirm with a CA (see DECISIONS.md).
 */
export function invoiceTax(order: Order, company: Company, code: TaxCode | undefined, buyerState?: string): InvoiceTax {
  const total = order.total.amount;
  const rate = code?.rate ?? 18;
  if (!company.gstin) {
    return { kind: "unregistered", taxable: money(total), cgst: money(0), sgst: money(0), igst: money(0), total: money(total), rate: 0, note: "Seller is not registered for GST. No tax charged." };
  }
  if (order.countryCode !== "IN") {
    return { kind: "export", taxable: money(total), cgst: money(0), sgst: money(0), igst: money(0), total: money(total), rate: 0, note: "Export of services. Zero-rated supply under LUT, IGST not charged." };
  }
  const taxable = Math.round(total / (1 + rate / 100));
  const tax = total - taxable;
  if (buyerState && buyerState === company.state) {
    const half = Math.round(tax / 2);
    return { kind: "intra", taxable: money(taxable), cgst: money(half), sgst: money(tax - half), igst: money(0), total: money(total), rate, note: `CGST ${rate / 2}% + SGST ${rate / 2}%, included in the price.` };
  }
  return { kind: "inter", taxable: money(taxable), cgst: money(0), sgst: money(0), igst: money(tax), total: money(total), rate, note: `IGST ${rate}%, included in the price.` };
}
