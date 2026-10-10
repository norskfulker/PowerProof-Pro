import type { OrderView } from "./server/order-types";

/**
 * The tax invoice for a paid order, worked out from what was actually charged. Prices include GST.
 * A seller with a GSTIN selling to India charges IGST; for goods shipped within the seller's own
 * state (the delivery address says which), CGST and SGST instead, half each. Shipping goes with the
 * goods (one supply), taxed at the main item's rate. Selling abroad is an export (zero-rated); no
 * GSTIN, no tax. Founder to confirm the treatment with a CA (see DECISIONS.md).
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
  kind: "igst" | "cgst_sgst" | "export" | "unregistered";
  lines: InvoiceLine[];
  taxable: number;
  tax: number;
  total: number;
  note: string;
}

/** The state in the store's company address (kept as six lines: address 1, address 2, city, state, PIN, country) */
export const sellerState = (address?: string) => (address ?? "").split("\n")[3]?.trim() ?? "";

export function invoiceModel(o: Pick<OrderView, "lines" | "buyerCountry" | "store" | "discount" | "total"> & Partial<Pick<OrderView, "shipping" | "codFee" | "shipTo">>): InvoiceModel {
  const registered = !!o.store.gstin;
  const india = (o.shipTo?.country ?? o.buyerCountry) === "IN";
  const sameState = !!o.shipTo?.state && sellerState(o.store.address).toLowerCase() === o.shipTo.state.toLowerCase();
  const kind: InvoiceModel["kind"] = !registered ? "unregistered" : india ? (sameState ? "cgst_sgst" : "igst") : "export";
  const taxed = kind === "igst" || kind === "cgst_sgst";
  const charges = (o.shipping ?? 0) + (o.codFee ?? 0);
  // Coupon savings sit on the whole order; spread them over the lines so the invoice adds up to what was paid
  const lineSum = o.lines.reduce((t, l) => t + l.total, 0);
  const goods = o.total - charges;
  const paidShare = lineSum > 0 ? goods / lineSum : 1;
  const line = (title: string, hsn: string | undefined, rateBps: number | undefined, total: number): InvoiceLine => {
    const rate = taxed ? (rateBps ?? 0) / 100 : 0;
    const taxable = rate > 0 ? Math.round(total / (1 + rate / 100)) : total;
    return { title, hsn, rate, taxable, tax: total - taxable, total };
  };
  const lines: InvoiceLine[] = o.lines.map((l) => line(`${l.title}${l.variant ? ` (${l.variant})` : ""}${l.quantity && l.quantity > 1 ? ` × ${l.quantity}` : ""}`, l.hsn, l.rateBps, Math.round(l.total * paidShare)));
  // Rounding per line can drift by a paisa: settle it on the last product line
  const drift = goods - lines.reduce((t, l) => t + l.total, 0);
  if (lines.length && drift) {
    const last = lines[lines.length - 1];
    last.total += drift;
    last.taxable += drift;
  }
  if (charges > 0) {
    // Shipping goes with the goods: the main (highest-rated) physical item's rate and code
    const main = [...o.lines].filter((l) => l.physical).sort((a, b) => (b.rateBps ?? 0) - (a.rateBps ?? 0))[0];
    lines.push(line(o.codFee ? "Shipping and cash on delivery" : "Shipping", main?.hsn, main?.rateBps, charges));
  }
  return {
    kind,
    lines,
    taxable: lines.reduce((t, l) => t + l.taxable, 0),
    tax: lines.reduce((t, l) => t + l.tax, 0),
    total: lines.reduce((t, l) => t + l.total, 0),
    note:
      kind === "unregistered"
        ? "The seller is not registered for GST. No tax is charged."
        : kind === "export"
          ? `Export of ${o.lines.some((l) => l.physical) ? "goods" : "services"}. Zero-rated supply under LUT; IGST is not charged.`
          : kind === "cgst_sgst"
            ? "CGST and SGST (half each) are included in the price."
            : "IGST is included in the price.",
  };
}
