import type { OrderView } from "./server/order-types";

/**
 * The tax invoice for a paid order, worked out from what was actually charged. Prices include GST.
 * A seller with a GSTIN selling to India charges IGST (the buyer's state isn't collected, so it
 * can't be split into CGST and SGST); selling abroad is an export of services; no GSTIN, no tax.
 * Founder to confirm the treatment with a CA (see DECISIONS.md).
 */
export interface InvoiceLine {
  title: string;
  hsn?: string;
  /** Percent, or 0 */
  rate: number;
  taxable: number;
  tax: number;
  total: number;
}

export interface InvoiceModel {
  kind: "igst" | "export" | "unregistered";
  lines: InvoiceLine[];
  taxable: number;
  tax: number;
  total: number;
  note: string;
}

export function invoiceModel(o: Pick<OrderView, "lines" | "buyerCountry" | "store" | "discount" | "total">): InvoiceModel {
  const registered = !!o.store.gstin;
  const india = o.buyerCountry === "IN";
  const kind: InvoiceModel["kind"] = !registered ? "unregistered" : india ? "igst" : "export";
  // Coupon savings sit on the whole order; spread them over the lines so the invoice adds up to what was paid
  const lineSum = o.lines.reduce((t, l) => t + l.total, 0);
  const paidShare = lineSum > 0 ? o.total / lineSum : 1;
  const lines: InvoiceLine[] = o.lines.map((l) => {
    const total = Math.round(l.total * paidShare);
    const rate = kind === "igst" ? (l.rateBps ?? 0) / 100 : 0;
    const taxable = rate > 0 ? Math.round(total / (1 + rate / 100)) : total;
    return { title: l.title, hsn: l.hsn, rate, taxable, tax: total - taxable, total };
  });
  // Rounding per line can drift by a paisa: settle it on the last line
  const drift = o.total - lines.reduce((t, l) => t + l.total, 0);
  if (lines.length && drift) {
    const last = lines[lines.length - 1];
    last.total += drift;
    last.taxable += drift;
  }
  return {
    kind,
    lines,
    taxable: lines.reduce((t, l) => t + l.taxable, 0),
    tax: lines.reduce((t, l) => t + l.tax, 0),
    total: lines.reduce((t, l) => t + l.total, 0),
    note: kind === "unregistered" ? "The seller is not registered for GST. No tax is charged." : kind === "export" ? "Export of services. Zero-rated supply under LUT; IGST is not charged." : "IGST is included in the price.",
  };
}
