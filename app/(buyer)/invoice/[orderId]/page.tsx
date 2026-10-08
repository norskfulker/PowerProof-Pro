"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useOrder } from "@/components/buyer/order-view";
import { MoneyText } from "@/components/pp/money-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { invoiceModel } from "@/lib/invoice-view";
import { formatDate } from "@/lib/format";
import type { CurrencyCode } from "@/lib/types";

/** The tax invoice for a paid order, ready to print or save as a PDF from the browser. */
export default function Page() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const t = useSearchParams().get("t");
  const o = useOrder(t);
  if (o.state === "loading") return <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-96 rounded-card" /></div>;
  if (o.state === "error") return <div className="mx-auto max-w-md p-10 text-center"><h1 className="text-2xl">We can&apos;t open that invoice.</h1><p className="mt-2 text-muted-foreground">{o.message}</p></div>;
  const order = o.order;
  const inv = invoiceModel(order);
  const c = order.currency as CurrencyCode;
  const m = (amount: number) => <MoneyText value={{ amount, currency: c }} />;
  return (
    <main className="mx-auto max-w-3xl p-4 print:p-0 md:p-8">
      <title>{`Invoice ${order.invoiceNo ?? order.ref}`}</title>
      <style>{`@media print{header,nav,.no-print{display:none!important}body{background:#fff!important}}`}</style>
      <div className="no-print mb-4 flex justify-end"><Button onClick={() => window.print()}><Printer aria-hidden /> Print or save as PDF</Button></div>
      <article className="rounded-card border bg-white p-6 text-[#0c1f1b] print:border-0 md:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
          <div>
            <h1 className="text-2xl">{inv.kind === "unregistered" ? "Invoice" : "Tax invoice"}</h1>
            <p className="mt-1 font-mono text-sm">{order.invoiceNo ?? order.ref}</p>
            {order.paidAt && <p className="text-sm text-[#6b7b75]">{formatDate(order.paidAt)}</p>}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{order.store.legalName || order.storeName}</p>
            {order.store.address && <p className="whitespace-pre-line text-[#6b7b75]">{order.store.address.split("\n").filter(Boolean).join(", ")}</p>}
            {order.store.gstin && <p>GSTIN <span className="font-mono">{order.store.gstin}</span></p>}
            {order.store.pan && <p>PAN <span className="font-mono">{order.store.pan}</span></p>}
          </div>
        </header>
        <section className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div><p className="text-xs text-[#6b7b75]">Billed to</p><p className="font-medium">{order.buyerName}</p><p>{order.buyerEmail}</p><p>{order.buyerCountry}</p></div>
          <div className="text-right"><p className="text-xs text-[#6b7b75]">Order</p><p className="font-mono">{order.ref}</p></div>
        </section>
        <table className="w-full text-left text-sm">
          <thead className="border-y text-xs text-[#6b7b75]">
            <tr><th className="py-2 pr-2 font-medium">Item</th><th className="py-2 pr-2 font-medium">HSN/SAC</th><th className="py-2 pr-2 text-right font-medium">Taxable</th>{inv.kind === "igst" && <th className="py-2 pr-2 text-right font-medium">IGST</th>}<th className="py-2 text-right font-medium">Amount</th></tr>
          </thead>
          <tbody className="divide-y">
            {inv.lines.map((l, i) => (
              <tr key={i}>
                <td className="py-2 pr-2">{l.title}</td>
                <td className="py-2 pr-2 font-mono text-xs">{l.hsn ?? "—"}</td>
                <td className="py-2 pr-2 text-right">{m(l.taxable)}</td>
                {inv.kind === "igst" && <td className="py-2 pr-2 text-right">{l.rate > 0 ? <>{m(l.tax)} <span className="text-xs text-[#6b7b75]">({l.rate}%)</span></> : "—"}</td>}
                <td className="py-2 text-right">{m(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 ml-auto flex max-w-xs flex-col gap-1 text-sm">
          <div className="flex justify-between"><dt>Taxable value</dt><dd>{m(inv.taxable)}</dd></div>
          {inv.kind === "igst" && <div className="flex justify-between"><dt>IGST</dt><dd>{m(inv.tax)}</dd></div>}
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total paid</dt><dd>{m(inv.total)}</dd></div>
        </dl>
        <footer className="mt-8 border-t pt-4 text-xs text-[#6b7b75]">
          <p>{inv.note}</p>
          {order.store.invoiceFooter && <p className="mt-1">{order.store.invoiceFooter}</p>}
        </footer>
      </article>
    </main>
  );
}
