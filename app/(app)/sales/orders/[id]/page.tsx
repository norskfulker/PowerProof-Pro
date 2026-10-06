"use client";

import { use, useState } from "react";
import Link from "next/link";
import { FileText, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { ProofReceipt } from "@/components/pp/proof-receipt";
import { StatusPill } from "@/components/pp/status-pill";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { useApi } from "@/hooks/use-api";
import { getOrder, getStore, refundOrder, resendReceipt } from "@/lib/api";
import { countryShort, formatDate, sourceLabel } from "@/lib/format";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = useApi(() => getOrder(id), [id], { live: true });
  const store = useApi(getStore, []);
  const [refunding, setRefunding] = useState(false);
  const [reason, setReason] = useState("");

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
  const canRefund = o.status === "paid" || o.status === "refund_requested";

  return (
    <>
      <PageHeader
        back={{ href: "/sales/orders", label: "Orders" }}
        eyebrow={formatDate(o.createdAt, { time: true })}
        title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono text-[1.75rem] tracking-tight">{o.number}</span> <StatusPill status={o.status} /></span>}
        actions={
          <>
            {o.invoiceNumber && (
              <Button asChild variant="secondary">
                <Link href={`/invoice/${o.id}`} target="_blank"><FileText aria-hidden /> Invoice</Link>
              </Button>
            )}
            {o.status === "paid" && (
              <Button
                variant="secondary"
                onClick={async () => {
                  await resendReceipt(o.id);
                  toast.success("Receipt sent again", { description: o.buyerEmail });
                }}
              >
                <Mail aria-hidden /> Resend receipt
              </Button>
            )}
            {canRefund && (
              <Button variant="danger" onClick={() => setRefunding(true)}>
                <RotateCcw aria-hidden /> Refund
              </Button>
            )}
          </>
        }
      />

      {o.status === "refund_requested" && (
        <div className="mb-6 rounded-card border border-warning/40 bg-warning-soft px-5 py-4 text-sm" role="status">
          <p className="font-semibold text-warning-ink">The buyer asked for a refund</p>
          <p className="mt-1">“{o.refundReason}”. Refund it, or reply to them at <a className="underline" href={`mailto:${o.buyerEmail}`}>{o.buyerEmail}</a>.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-card border bg-surface p-5 md:p-6" aria-labelledby="tl-h">
            <h2 id="tl-h" className="font-sans text-base font-semibold tracking-normal">What happened</h2>
            <OrderTimeline order={o} />
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
              <p className="text-sm text-muted-foreground">{countryShort(o.countryCode)} · came from {sourceLabel(o.source)}</p>
            </div>
            <div>
              <p className="eyebrow">Product</p>
              <Link href={`/catalog/products/${o.productId}`} className="mt-1 flex pointer-coarse:min-h-11 items-center font-semibold hover:underline">{o.productTitle}</Link>
              <p className="text-sm text-muted-foreground">Downloaded {o.downloads} time{o.downloads === 1 ? "" : "s"}</p>
            </div>
          </section>
        </div>
        <ProofReceipt order={o} storeName={store.data?.name ?? ""} showFees />
      </div>

      <ConfirmDialog
        open={refunding}
        onOpenChange={setRefunding}
        title={`Refund ${o.number}?`}
        description={
          <>
            <MoneyText value={o.buyerTotal} /> goes back to {o.buyerName || "the buyer"} in 5 to 7 working days and their download link stops working. Fees aren&apos;t returned by the gateway. This can&apos;t be undone.
          </>
        }
        confirmLabel="Refund order"
        onConfirm={async () => {
          try {
            const out = await refundOrder(o.id, reason);
            order.setData(out);
            toast.success("Refund started", { description: `${o.number} · ${o.buyerEmail}` });
          } catch (e) {
            toast.error("Couldn't refund", { description: e instanceof Error ? e.message : undefined });
            throw e;
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rf-reason">Reason (only you see this)</Label>
          <Textarea id="rf-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bought it twice by mistake" />
        </div>
      </ConfirmDialog>
    </>
  );
}
