import type { OrderView } from "@/lib/server/order-types";

/**
 * What goes in the parcel: who it's for, where it goes, and what to pack. No prices, so it can
 * travel with a gift. Paper colours, like the invoice.
 */
export function PackingSlip({ order }: { order: OrderView }) {
  const seller = order.store.invoiceName?.trim() || order.storeName;
  const to = order.shipTo;
  const items = order.lines.filter((l) => l.physical !== false);
  return (
    <article className="rounded-card border bg-white p-6 text-[#0c1f1b] print:border-0 md:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
        <div>
          <h1 className="text-2xl">Packing slip</h1>
          <p className="mt-1 font-mono text-sm">{order.ref}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-xs text-[#6b7b75]">From</p>
          <p className="font-semibold">{seller}</p>
          {order.store.address && <p className="whitespace-pre-line text-[#6b7b75]">{order.store.address.split("\n").filter(Boolean).join(", ")}</p>}
        </div>
      </header>
      <section className="py-6 text-sm">
        <p className="text-xs text-[#6b7b75]">Ship to</p>
        {to ? (
          <>
            <p className="text-base font-semibold">{to.name}</p>
            <p>{to.line1}</p>
            {to.line2 && <p>{to.line2}</p>}
            <p>{[to.city, to.state, to.pincode].filter(Boolean).join(", ")}</p>
            <p>{to.country}</p>
            {to.phone && <p className="mt-1 font-mono">{to.phone}</p>}
          </>
        ) : (
          <p className="font-semibold">{order.buyerName}</p>
        )}
        {order.paymentMethod === "cod" && <p className="mt-3 inline-block rounded border border-[#0c1f1b] px-2 py-0.5 font-semibold">Cash on delivery</p>}
      </section>
      <table className="w-full text-left text-sm">
        <thead className="border-y text-xs text-[#6b7b75]">
          <tr>
            <th className="w-10 py-2 pr-2 font-medium">Packed</th>
            <th className="py-2 pr-2 font-medium">Item</th>
            <th className="py-2 text-right font-medium">Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((l, i) => (
            <tr key={i}>
              <td className="py-2 pr-2"><span aria-hidden className="inline-block size-4 rounded-sm border border-[#0c1f1b]" /></td>
              <td className="py-2 pr-2">{l.title}{l.variant ? ` (${l.variant})` : ""}{l.gift ? " · gift" : ""}</td>
              <td className="py-2 text-right font-mono">{l.quantity ?? 1}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="mt-8 border-t pt-4 text-xs text-[#6b7b75]">
        <p>Thank you for your order. Questions? {order.supportEmail ?? "Reply to your order email."}</p>
      </footer>
    </article>
  );
}
