"use client";

import { use } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { LogoMark } from "@/components/pp/logo";
import { MoneyText } from "@/components/pp/money-text";
import { useApi } from "@/hooks/use-api";
import { getInvoice } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { invoiceTax } from "@/lib/invoice";
import { formatMoney } from "@/lib/money";

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-4 border-t pt-2 font-semibold" : "flex justify-between gap-4"}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default function InvoicePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const { data, error, reload } = useApi(() => getInvoice(orderId), [orderId]);
  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="order" />;

  const { order, store, company, settings, taxCode, sku } = data;
  const tax = invoiceTax(order, company, taxCode);
  const seller = company.legalName || store.ownerName;
  const converted = order.buyerTotal.currency !== order.total.currency;

  return (
    <BuyerShell store={store} narrow>
      <title>{`Invoice ${order.invoiceNumber}`}</title>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">Keep this for your records or your accountant.</p>
        <Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden /> Print or save PDF</Button>
      </div>
      <article className="rounded-card border bg-surface p-6 text-sm print:border-0 print:p-0 sm:p-8" aria-label={`Tax invoice ${order.invoiceNumber}`}>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="eyebrow">{company.gstin && settings.showGstin ? "Tax invoice" : "Invoice"}</p>
            <h1 className="mt-1 font-mono text-2xl tracking-tight">{order.invoiceNumber}</h1>
            <p className="text-muted-foreground">Issued {formatDate(order.paidAt ?? order.createdAt)} · Order {order.number}</p>
          </div>
          <LogoMark className="size-9" />
        </header>

        <div className="grid gap-6 border-b py-5 sm:grid-cols-2">
          <div>
            <p className="eyebrow mb-1">From</p>
            <p className="font-semibold">{seller}</p>
            <p className="text-muted-foreground">Trading as {store.name}</p>
            {company.address1 && <p>{company.address1}{company.address2 ? `, ${company.address2}` : ""}</p>}
            {company.city && <p>{company.city}, {company.state} {company.pincode}</p>}
            {company.gstin && settings.showGstin && <p className="mt-1 font-mono text-xs">GSTIN {company.gstin}</p>}
          </div>
          <div>
            <p className="eyebrow mb-1">Billed to</p>
            <p className="font-semibold">{order.buyerName}</p>
            <p>{order.buyerEmail}</p>
            <p className="text-muted-foreground">{order.country}</p>
            <p className="mt-1 text-xs text-muted-foreground">Place of supply: {order.countryCode === "IN" ? "India" : `${order.country} (outside India)`}</p>
          </div>
        </div>

        <div className="overflow-x-auto py-5">
          <table className="w-full min-w-[440px]">
            <thead>
              <tr className="eyebrow text-left">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium">{taxCode?.kind ?? "SAC"}</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Taxable value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-3 pr-3">
                  <span className="font-medium">{order.productTitle}</span>
                  {sku && <span className="block font-mono text-xs text-muted-foreground">SKU {sku}</span>}
                </td>
                <td className="py-3 font-mono text-xs">{taxCode?.code ?? settings.defaultTaxCode}</td>
                <td className="py-3 text-right font-mono">1</td>
                <td className="py-3 text-right"><MoneyText value={tax.taxable} mono /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <dl className="ml-auto flex max-w-xs flex-col gap-2 border-t pt-4">
          <Row label="Taxable value"><MoneyText value={tax.taxable} mono /></Row>
          {tax.kind === "intra" && (
            <>
              <Row label={`CGST ${tax.rate / 2}%`}><MoneyText value={tax.cgst} mono /></Row>
              <Row label={`SGST ${tax.rate / 2}%`}><MoneyText value={tax.sgst} mono /></Row>
            </>
          )}
          {tax.kind === "inter" && <Row label={`IGST ${tax.rate}%`}><MoneyText value={tax.igst} mono /></Row>}
          <Row label="Total" strong><MoneyText value={tax.total} mono /></Row>
          {converted && <Row label="Paid by buyer"><span className="font-mono text-[13px]">{formatMoney(order.buyerTotal)}</span></Row>}
        </dl>

        <footer className="mt-6 flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground">
          <p>{tax.note}</p>
          <p>Paid by {order.paymentMethod.toUpperCase()} on {formatDate(order.paidAt ?? order.createdAt, { time: true })}. Digital goods delivered electronically.</p>
          <p>{settings.footerNote}</p>
        </footer>
      </article>
    </BuyerShell>
  );
}
