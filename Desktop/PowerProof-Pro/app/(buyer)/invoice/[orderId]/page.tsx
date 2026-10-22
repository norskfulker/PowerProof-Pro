"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useOrder } from "@/components/buyer/order-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceSheet } from "@/components/orders/invoice-sheet";

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
  return (
    <main className="mx-auto max-w-3xl p-4 print:p-0 md:p-8">
      <title>{`Invoice ${order.invoiceNo ?? order.ref}`}</title>
      <style>{`@media print{header,nav,.no-print{display:none!important}body{background:#fff!important}}`}</style>
      <div className="no-print mb-4 flex justify-end"><Button onClick={() => window.print()}><Printer aria-hidden /> Print or save as PDF</Button></div>
      <InvoiceSheet order={order} />
    </main>
  );
}
