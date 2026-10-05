"use client";

import { use } from "react";
import Link from "next/link";
import { Check, Download, LifeBuoy, Mail, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { CopyField } from "@/components/pp/copy-field";
import { ProofReceipt } from "@/components/pp/proof-receipt";
import { useApi } from "@/hooks/use-api";
import { getOrderForSuccess } from "@/lib/api";

/** Calm confirmation: download first, then the order number, receipt and review link. */
export default function SuccessPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const { data, error, reload } = useApi(() => getOrderForSuccess(orderId), [orderId]);

  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="order" />;
  const { order, store, design } = data;

  if (order.status !== "paid" && order.status !== "refund_requested") {
    return (
      <BuyerShell store={store} theme={design.theme} narrow>
        <title>Payment not finished</title>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <h1 className="text-[1.75rem]">This order isn&apos;t paid yet.</h1>
          <p className="text-muted-foreground">No money has been taken. Go back to checkout to finish.</p>
          <Button asChild className="mt-2"><Link href={`/checkout/${order.id}`}>Back to checkout</Link></Button>
        </div>
      </BuyerShell>
    );
  }

  const orderLink = `/order/${order.token}`;
  return (
    <BuyerShell store={store} theme={design.theme} narrow>
      <title>{`Paid · ${order.productTitle}`}</title>
      <section className="flex flex-col items-center gap-3 pt-2 pb-8 text-center" aria-live="polite">
        <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
          <Check className="size-7" strokeWidth={2.5} aria-hidden />
        </span>
        <h1 className="text-[2rem] leading-tight">Payment received.</h1>
        <p className="max-w-sm text-muted-foreground">
          Thanks{order.buyerName ? `, ${order.buyerName.split(" ")[0]}` : ""}. Order <span className="font-mono font-semibold text-foreground">{order.number}</span> is ready.
        </p>
        <Button asChild size="lg" className="mt-3 h-14 w-full text-lg sm:w-auto sm:px-10">
          <Link href={orderLink}><Download aria-hidden /> Download your files</Link>
        </Button>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mail className="size-4" aria-hidden /> Receipt and download link sent to {order.buyerEmail}
        </p>
      </section>

      <div className="flex flex-col gap-4">
        <ProofReceipt order={order} storeName={store.name} />
        <CopyField label="Your private order link" value={`${typeof window === "undefined" ? "" : window.location.origin}${orderLink}`} display={`…${orderLink}`} toastText="Order link copied" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button asChild variant="secondary"><Link href={`${orderLink}#review`}><Star aria-hidden /> Write a review</Link></Button>
          <Button asChild variant="secondary"><Link href={`/invoice/${order.id}`} target="_blank">Tax invoice</Link></Button>
          <Button asChild variant="ghost"><Link href={`/s/${store.slug}/contact`}><LifeBuoy aria-hidden /> Need help?</Link></Button>
        </div>
      </div>
    </BuyerShell>
  );
}
