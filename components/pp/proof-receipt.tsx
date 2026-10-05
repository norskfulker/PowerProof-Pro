import { formatDate } from "@/lib/format";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { MoneyText } from "./money-text";
import { StatusPill } from "./status-pill";

const METHOD: Record<Order["paymentMethod"], string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Netbanking",
  wallet: "Wallet",
};

/**
 * The "proof": a receipt-style summary of a purchase. Used on success, delivery,
 * order detail and in the buyer lookup.
 */
export function ProofReceipt({
  order,
  storeName,
  className,
  showFees,
}: {
  order: Order;
  storeName: string;
  className?: string;
  /** Creator view shows the fee split. */
  showFees?: boolean;
}) {
  const converted = order.buyerTotal.currency !== order.total.currency;
  return (
    <section
      aria-label={`Receipt for order ${order.number}`}
      className={cn("relative overflow-hidden rounded-card border bg-surface", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-border-strong px-5 py-4">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-6" />
          <span className="eyebrow">Proof of purchase</span>
        </div>
        <StatusPill status={order.status} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 px-5 py-4 text-sm">
        <dt className="text-muted-foreground">Order</dt>
        <dd className="text-right font-mono text-[13px]">{order.number}</dd>
        <dt className="text-muted-foreground">Item</dt>
        <dd className="text-right font-medium">{order.productTitle}</dd>
        <dt className="text-muted-foreground">Sold by</dt>
        <dd className="text-right">{storeName}</dd>
        <dt className="text-muted-foreground">Date</dt>
        <dd className="text-right">{formatDate(order.paidAt ?? order.createdAt, { time: true })}</dd>
        {order.buyerEmail && (
          <>
            <dt className="text-muted-foreground">Sent to</dt>
            <dd className="truncate text-right">{order.buyerEmail}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Paid with</dt>
        <dd className="text-right">{METHOD[order.paymentMethod]}</dd>
        {order.invoiceNumber && (
          <>
            <dt className="text-muted-foreground">Invoice</dt>
            <dd className="text-right font-mono text-[13px]">{order.invoiceNumber}</dd>
          </>
        )}
      </dl>
      {showFees && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-dashed border-border-strong px-5 py-4 text-sm">
          <dt className="text-muted-foreground">Gateway fee</dt>
          <dd className="text-right"><MoneyText value={{ ...order.fees.gateway, amount: -order.fees.gateway.amount }} mono /></dd>
          <dt className="text-muted-foreground">PowerProof fee</dt>
          <dd className="text-right"><MoneyText value={{ ...order.fees.platform, amount: -order.fees.platform.amount }} mono /></dd>
          <dt className="font-semibold">You keep</dt>
          <dd className="text-right"><MoneyText value={order.net} mono className="font-semibold" /></dd>
        </dl>
      )}
      <div className="flex items-end justify-between gap-4 border-t border-dashed border-border-strong bg-surface-sunken px-5 py-4">
        <span className="font-semibold">Total</span>
        <span className="text-right">
          <MoneyText value={order.buyerTotal} className="font-display text-2xl font-extrabold" />
          {converted && (
            <span className="block font-mono text-[11px] text-muted-foreground">
              Settled as <MoneyText value={order.total} />
            </span>
          )}
        </span>
      </div>
    </section>
  );
}
