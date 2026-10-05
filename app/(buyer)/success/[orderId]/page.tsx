"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { ProofReceipt } from "@/components/pp/proof-receipt";
import { useApi } from "@/hooks/use-api";
import { getDelivery } from "@/lib/api";

export default function SuccessPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const { data, error, reload } = useApi(() => getDelivery(orderId), [orderId]);

  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="order" />;
  const { order, store, product } = data;

  if (order.status !== "paid" && order.status !== "refund_requested") {
    return (
      <BuyerShell store={store} narrow>
        <title>Payment not finished</title>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <h1 className="text-[28px]">This order isn&apos;t paid yet.</h1>
          <p className="text-muted-foreground">No money has been taken. Go back to checkout to finish.</p>
          <Button asChild className="mt-2"><Link href={`/checkout/${order.id}`}>Back to checkout</Link></Button>
        </div>
      </BuyerShell>
    );
  }

  return (
    <BuyerShell store={store} narrow>
      <title>{`Paid · ${product.title}`}</title>
      <section className="flex flex-col items-center gap-3 pt-2 pb-8 text-center" aria-live="polite">
        <span className="grid size-16 place-items-center rounded-full bg-success text-primary-foreground">
          <Check className="size-8" strokeWidth={2.5} aria-hidden />
        </span>
        <h1 className="text-[34px] leading-tight">Paid. It&apos;s yours.</h1>
        <p className="max-w-sm text-muted-foreground">
          Thanks{order.buyerName ? `, ${order.buyerName.split(" ")[0]}` : ""}. Your download is ready now, and a copy of the link is on its way to your inbox.
        </p>
        <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
          <Link href={`/download/${order.id}`}>
            Download now <ArrowRight aria-hidden />
          </Link>
        </Button>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mail className="size-4" aria-hidden /> Sent to {order.buyerEmail}
        </p>
      </section>
      <ProofReceipt order={order} storeName={store.name} />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild variant="secondary" size="sm"><Link href={`/invoice/${order.id}`} target="_blank">Tax invoice</Link></Button>
        <Button asChild variant="ghost" size="sm"><Link href={`/emails/receipt?order=${order.id}`}>See the receipt email</Link></Button>
      </div>
    </BuyerShell>
  );
}
