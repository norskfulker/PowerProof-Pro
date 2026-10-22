"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { InvoiceSheet } from "@/components/orders/invoice-sheet";
import { PackingSlip } from "@/components/orders/packing-slip";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getOrderViews } from "@/lib/api";

/**
 * Sales › Orders › Print: invoices or packing slips for one order or many (?ids=a,b&kind=slip),
 * one per page when printed. Invoices only exist for paid orders; slips only for shipped goods.
 */
export default function PrintOrdersPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const kind = params.get("kind") === "slip" ? "slip" : "invoice";
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const { data, error, reload } = useApi(() => getOrderViews(ids), [ids.join(",")]);
  const docs = (data ?? []).filter((o) => (kind === "invoice" ? o.status === "paid" : !!o.shipTo));
  const skipped = (data?.length ?? 0) - docs.length;
  const title = kind === "invoice" ? "Invoices" : "Packing slips";

  return (
    <>
      <title>{`${title} · PowerProof`}</title>
      <style>{`@media print{[data-print-hide],header,nav,aside{display:none!important}main{padding:0!important}body{background:#fff!important}.pp-sheet{break-after:page}}`}</style>
      <div data-print-hide>
        <PageHeader
          back={{ href: ids.length === 1 ? `/sales/orders/${ids[0]}` : "/sales/orders", label: ids.length === 1 ? "Order" : "Orders" }}
          title={`${title}${docs.length > 1 ? ` (${docs.length})` : ""}`}
          actions={<Button onClick={() => window.print()} disabled={!docs.length}><Printer aria-hidden /> Print or save as PDF</Button>}
        />
        {skipped > 0 && (
          <p className="mb-4 text-sm text-muted-foreground">
            {skipped} {skipped === 1 ? "order isn't" : "orders aren't"} included: {kind === "invoice" ? "invoices are for paid orders" : "packing slips are for orders that ship"}.
          </p>
        )}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-[40rem] rounded-card" />
      ) : !docs.length ? (
        <ErrorState title={`Nothing to print.`} message={kind === "invoice" ? "None of these orders is paid." : "None of these orders ships."} />
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 print:gap-0">
          {docs.map((o) => (
            <div key={o.id} className="pp-sheet">{kind === "invoice" ? <InvoiceSheet order={o} /> : <PackingSlip order={o} />}</div>
          ))}
        </div>
      )}
    </>
  );
}
