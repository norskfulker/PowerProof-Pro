import { MoneyText } from "@/components/pp/money-text";
import { invoiceModel } from "@/lib/invoice-view";
import { formatDate } from "@/lib/format";
import type { OrderView } from "@/lib/server/order-types";
import type { CurrencyCode } from "@/lib/types";

/**
 * One order's invoice on paper colours (always light, also in print). Used by the buyer's invoice
 * link and the creator's print page (Sales › Orders › Print), so both show the same document.
 */
export function InvoiceSheet({ order }: { order: OrderView }) {
  const inv = invoiceModel(order);
  // The name the seller chose for invoices; older stores fall back to the legal name, then the store's name
  const seller = order.store.invoiceName?.trim() || order.store.legalName?.trim() || order.storeName;
  const c = order.currency as CurrencyCode;
  const m = (amount: number) => <MoneyText value={{ amount, currency: c }} />;
  return (
    <article className="rounded-card border bg-white p-6 text-[#0c1f1b] print:border-0 md:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
        <div>
          <h1 className="text-2xl">{inv.kind === "unregistered" ? "Invoice" : "Tax invoice"}</h1>
          <p className="mt-1 font-mono text-sm">{order.invoiceNo ?? order.ref}</p>
          {order.paidAt && <p className="text-sm text-[#6b7b75]">{formatDate(order.paidAt)}</p>}
        </div>
        <div className="text-right text-sm">
          <p className="text-xs text-[#6b7b75]">Sold by</p>
          <p className="font-semibold">{seller}</p>
          {order.store.gstin && order.store.legalName && order.store.legalName !== seller && <p>{order.store.legalName}</p>}
          {order.store.address && <p className="whitespace-pre-line text-[#6b7b75]">{order.store.address.split("\n").filter(Boolean).join(", ")}</p>}
          {order.store.gstin && <p>GSTIN <span className="font-mono">{order.store.gstin}</span></p>}
          {order.store.pan && <p>PAN <span className="font-mono">{order.store.pan}</span></p>}
        </div>
      </header>
      <section className="grid grid-cols-2 gap-6 py-6 text-sm">
        <div><p className="text-xs text-[#6b7b75]">Billed to</p><p className="font-medium">{order.buyerName}</p><p>{order.buyerEmail}</p><p>{[order.buyerState, order.buyerCountry].filter(Boolean).join(", ")}</p></div>
        <div className="text-right">
          <p className="text-xs text-[#6b7b75]">Order</p>
          <p className="font-mono">{order.ref}</p>
          {order.shipTo && (
            <>
              <p className="mt-2 text-xs text-[#6b7b75]">Shipped to (place of supply)</p>
              <p>{[order.shipTo.city, order.shipTo.state, order.shipTo.pincode].filter(Boolean).join(", ")}</p>
            </>
          )}
        </div>
      </section>
      <table className="w-full text-left text-sm">
        <thead className="border-y text-xs text-[#6b7b75]">
          <tr><th className="py-2 pr-2 font-medium">Item</th><th className="py-2 pr-2 font-medium">HSN/SAC</th><th className="py-2 pr-2 text-right font-medium">Taxable</th>{inv.kind === "igst" && <th className="py-2 pr-2 text-right font-medium">IGST</th>}{inv.kind === "cgst_sgst" && <><th className="py-2 pr-2 text-right font-medium">CGST</th><th className="py-2 pr-2 text-right font-medium">SGST</th></>}<th className="py-2 text-right font-medium">Amount</th></tr>
        </thead>
        <tbody className="divide-y">
          {inv.lines.map((l, i) => (
            <tr key={i}>
              <td className="py-2 pr-2">{l.title}</td>
              <td className="py-2 pr-2 font-mono text-xs">{l.hsn ?? "—"}</td>
              <td className="py-2 pr-2 text-right">{m(l.taxable)}</td>
              {inv.kind === "igst" && <td className="py-2 pr-2 text-right">{l.rate > 0 ? <>{m(l.tax)} <span className="text-xs text-[#6b7b75]">({l.rate}%)</span></> : "—"}</td>}
              {inv.kind === "cgst_sgst" && (
                <>
                  <td className="py-2 pr-2 text-right">{l.rate > 0 ? <>{m(Math.floor(l.tax / 2))} <span className="text-xs text-[#6b7b75]">({l.rate / 2}%)</span></> : "—"}</td>
                  <td className="py-2 pr-2 text-right">{l.rate > 0 ? <>{m(l.tax - Math.floor(l.tax / 2))} <span className="text-xs text-[#6b7b75]">({l.rate / 2}%)</span></> : "—"}</td>
                </>
              )}
              <td className="py-2 text-right">{m(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-4 ml-auto flex max-w-xs flex-col gap-1 text-sm">
        <div className="flex justify-between"><dt>Taxable value</dt><dd>{m(inv.taxable)}</dd></div>
        {inv.kind === "igst" && <div className="flex justify-between"><dt>IGST</dt><dd>{m(inv.tax)}</dd></div>}
        {inv.kind === "cgst_sgst" && (
          <>
            <div className="flex justify-between"><dt>CGST</dt><dd>{m(inv.lines.reduce((t, l) => t + Math.floor(l.tax / 2), 0))}</dd></div>
            <div className="flex justify-between"><dt>SGST</dt><dd>{m(inv.lines.reduce((t, l) => t + l.tax - Math.floor(l.tax / 2), 0))}</dd></div>
          </>
        )}
        <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total paid</dt><dd>{m(inv.total)}</dd></div>
      </dl>
      <footer className="mt-8 border-t pt-4 text-xs text-[#6b7b75]">
        <p>{inv.note}</p>
        {order.store.invoiceFooter && <p className="mt-1">{order.store.invoiceFooter}</p>}
      </footer>
    </article>
  );
}
