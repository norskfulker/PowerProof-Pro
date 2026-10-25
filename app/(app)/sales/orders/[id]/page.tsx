"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import Link from "next/link";
import { Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { ProofReceipt } from "@/components/pp/proof-receipt";
import { StatusPill } from "@/components/pp/status-pill";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { PaymentEventList } from "@/components/orders/payment-events";
import { UnpaidTimer } from "@/components/orders/unpaid-timer";
import { LiveStatusBadge } from "@/components/pp/live-status";
import { useLiveStore } from "@/hooks/use-live-store";
import { getPaymentEvents } from "@/lib/api/activity";
import { formatDate } from "@/lib/format";
import { ShippingCard } from "@/components/orders/shipping-card";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getOrder, refundOrder, resendReceipt } from "@/lib/api";
import { countryShort, sourceLabel } from "@/lib/format";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = useApi(() => getOrder(id), [id], { live: true });
  const payments = useApi(() => getPaymentEvents({ orderId: id, limit: 100 }), [id], { live: true });
  // A payment, failure or cancellation shows up here as it happens
  const live = useLiveStore(["orders", "payment_events"], () => {
    order.reload();
    payments.reload();
  });
  const store = useCurrentStore();
  const [busy, setBusy] = useState<"mail" | undefined>();
  const [confirm, setConfirm] = useState(false);

  if (order.error) {
    return (
      <>
        <PageHeader title="Order" back={{ href: "/sales/orders", label: "Orders" }} />
        <ErrorState title={order.error.includes("not found") ? "We can't find that order." : undefined} message={order.error} onRetry={order.reload} />
      </>
    );
  }
  if (!order.data) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }

  const o = order.data;
  // A payment that arrived after the order was cancelled, not yet given back
  const lateEvent = payments.data?.find((e) => e.kind === "late_payment");
  const lateRefunded = !!lateEvent && !!payments.data?.some((e) => e.paymentId === lateEvent.paymentId && (e.kind === "refund_requested" || e.kind === "refund_processing" || e.kind === "refunded"));
  const lateOpen = o.status === "cancelled" && !!lateEvent && !lateRefunded;
  const canRefund = o.status === "paid" || o.status === "refund_requested" || lateOpen;

  return (
    <>
      <PageHeader
        back={{ href: "/sales/orders", label: "Orders" }}
        title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono text-[1.75rem] tracking-tight">{o.number}</span> <StatusPill status={o.status} /> <UnpaidTimer order={o} /></span>}
        actions={
          <>
            {o.status === "paid" && (
              <Button
                variant="secondary"
                disabled={busy !== undefined}
                onClick={async () => {
                  setBusy("mail");
                  try {
                    await resendReceipt(id);
                    toast.success("Receipt sent", { description: `A fresh link went to ${o.buyerEmail}.` });
                  } catch (e) {
                    toast.error("Couldn't send it", { description: e instanceof Error ? e.message : undefined });
                  }
                  setBusy(undefined);
                }}
              >
                <Mail aria-hidden /> Resend receipt
              </Button>
            )}
            {canRefund && (
              <Button variant="danger" disabled={busy !== undefined} onClick={() => setConfirm(true)}>
                <RotateCcw aria-hidden /> Refund
              </Button>
            )}
          </>
        }
      />

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={lateOpen ? `Refund the late payment on ${o.number}?` : `Refund ${o.number}?`}
        description={
          lateOpen
            ? `${o.buyerName} paid after this order was cancelled. The full amount goes back to their original payment method. The order stays cancelled.`
            : o.payment === "cod"
            ? `${o.buyerName} paid in cash, so give the money back to them yourself. PowerProof returns its fee to your balance. This can't be undone.`
            : `The full amount goes back to ${o.buyerName}'s original payment method, their downloads stop, and your balance is reduced. This can't be undone.`
        }
        confirmLabel="Refund the full amount"
        onConfirm={async () => {
          try {
            await refundOrder(id, o.refundReason ?? "Refunded by the seller");
            toast.success("Refunded", { description: "The money is on its way back to the buyer." });
            order.reload();
          } catch (e) {
            toast.error("The refund didn't go through", { description: e instanceof Error ? e.message : undefined });
            throw e;
          }
        }}
      />

      {o.status === "cancelled" && (
        <div className={`mb-6 rounded-card border px-5 py-4 text-sm ${lateOpen ? "border-danger/40 bg-danger-soft" : "bg-surface-sunken"}`} role="status">
          <p className={`font-semibold ${lateOpen ? "text-danger" : ""}`}>{lateOpen ? "Payment received after cancellation: refund it" : "Cancelled automatically"}</p>
          <p className="mt-1">
            {o.cancelReason ?? "Payment not received within 1 hour"}
            {o.cancelledAt ? `, ${formatDate(o.cancelledAt, { time: true })}` : ""}.
            {lateOpen ? " The buyer was charged afterwards, so give the money back with Refund." : lateRefunded ? " A late payment on it has been refunded." : " Nothing was charged and no stock was taken."}
          </p>
        </div>
      )}

      {o.status === "refund_requested" && (
        <div className="mb-6 rounded-card border border-warning/40 bg-warning-soft px-5 py-4 text-sm" role="status">
          <p className="font-semibold text-warning-ink">The buyer asked for a refund</p>
          <p className="mt-1">“{o.refundReason}”. Refund it, or reply to them at <a className="underline" href={`mailto:${o.buyerEmail}`}>{o.buyerEmail}</a>.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          {o.fulfilment && <ShippingCard order={o} onChange={(next) => order.setData(next)} />}
          <section className="rounded-card border bg-surface p-5 md:p-6" aria-labelledby="tl-h">
            <h2 id="tl-h" className="font-sans text-base font-semibold tracking-normal">What happened</h2>
            <OrderTimeline order={o} />
          </section>
          <section className="overflow-hidden rounded-card border bg-surface" aria-labelledby="pay-h">
            <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <h2 id="pay-h" className="font-sans text-base font-semibold tracking-normal">Payment activity</h2>
              <LiveStatusBadge status={live} />
            </header>
            {payments.error ? (
              <ErrorState className="m-4" message={payments.error} onRetry={payments.reload} />
            ) : !payments.data ? (
              <Skeleton className="m-4 h-24" />
            ) : payments.data.length ? (
              <PaymentEventList events={payments.data} />
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">No payment steps recorded for this order. Payment tracking covers orders placed after it was switched on.</p>
            )}
          </section>
          <section className="grid grid-cols-1 gap-4 rounded-card border bg-surface p-5 sm:grid-cols-2 md:p-6" aria-label="Buyer and product">
            <div>
              <p className="eyebrow">Buyer</p>
              {o.customerId ? (
                <Link href={`/sales/customers/${o.customerId}`} className="mt-1 flex pointer-coarse:min-h-11 items-center font-semibold hover:underline">{o.buyerName}</Link>
              ) : (
                <p className="mt-1 text-muted-foreground">Not paid yet</p>
              )}
              <p className="text-sm text-muted-foreground">{o.buyerEmail}</p>
              <p className="text-sm text-muted-foreground">{[o.countryCode ? countryShort(o.countryCode) : "", o.buyerState ?? "", o.source ? `came from ${sourceLabel(o.source)}` : ""].filter(Boolean).join(" · ")}</p>
            </div>
            <div>
              <p className="eyebrow">Product</p>
              <Link href={`/catalog/products/${o.productId}`} className="mt-1 flex pointer-coarse:min-h-11 items-center font-semibold hover:underline">{o.productTitle}</Link>
            </div>
          </section>
        </div>
        <ProofReceipt order={o} storeName={store.data?.name ?? ""} showFees />
      </div>
    </>
  );
}
