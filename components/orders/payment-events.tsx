"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { copyText } from "@/components/pp/copy-field";
import { Button } from "@/components/ui/button";
import type { PaymentEvent } from "@/lib/api/activity";
import { formatDate, timeAgo } from "@/lib/format";
import { formatMoney, money } from "@/lib/money";
import { PAYMENT_EVENT_LABEL, PAYMENT_EVENT_TONE, type PaymentTone } from "@/lib/payment-events";
import type { CurrencyCode } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE: Record<PaymentTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-muted text-muted-foreground",
};

const SOURCE: Record<PaymentEvent["source"], string> = {
  provider: "Confirmed by the payment provider",
  app: "Recorded by PowerProof",
  inferred: "Inferred by PowerProof, not confirmed by the provider",
};

const METHOD: Record<string, string> = { upi: "UPI", card: "Card", netbanking: "Netbanking", wallet: "Wallet", emi: "EMI", paylater: "Pay later" };
const provider = (p: string) => (p === "razorpay" ? "Razorpay" : p === "own_razorpay" ? "Your Razorpay" : p === "stripe" ? "Stripe" : p === "custom" ? "Your gateway" : p);

/** The badge for one payment step: label and colour from its kind */
export function PaymentEventBadge({ kind, className }: { kind: PaymentEvent["kind"]; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap", TONE[PAYMENT_EVENT_TONE[kind]], className)}>{PAYMENT_EVENT_LABEL[kind]}</span>;
}

/** The provider's reason, or "Reason unavailable" when it gave none for a step that usually has one */
function Reason({ e }: { e: PaymentEvent }) {
  if (e.reason) return <span className="text-foreground">{e.reason}</span>;
  if (e.reasonMissing) return <span className="text-muted-foreground italic">Reason unavailable</span>;
  return null;
}

/**
 * One row per payment step, newest first: what happened, the amount, the provider and method, the
 * exact time, the provider's reason and error code, and where it came from (provider-confirmed or
 * recorded by the app). `showOrder` adds the order and buyer, for the store-wide feed.
 */
export function PaymentEventList({ events, showOrder = false, fresh }: { events: PaymentEvent[]; showOrder?: boolean; fresh?: Set<string> }) {
  return (
    <ul className="flex flex-col divide-y" aria-live="polite" aria-relevant="additions">
      {events.map((e) => (
        <li key={e.id} className={cn("flex flex-col gap-2 px-4 py-3 transition-colors duration-700 sm:flex-row sm:items-start sm:gap-4", fresh?.has(e.id) && "bg-accent-soft")}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex flex-wrap items-center gap-2">
              <PaymentEventBadge kind={e.kind} />
              {showOrder && e.orderId && (
                <Link href={`/sales/orders/${e.orderId}`} className="font-mono text-sm font-medium hover:underline">
                  {e.orderRef ?? "Order"}
                </Link>
              )}
              {showOrder && e.buyerName && <span className="truncate text-sm text-muted-foreground">{e.buyerName}</span>}
            </p>
            <p className="text-sm">
              <Reason e={e} />
              {e.errorCode && <span className="ml-2 font-mono text-xs text-muted-foreground">{e.errorCode}</span>}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{provider(e.provider)}</span>
              {e.method && <span>· {METHOD[e.method] ?? e.method}</span>}
              {(e.paymentId || e.refundId) && (
                <span className="inline-flex items-center gap-1">
                  · <span className="font-mono">{e.refundId ?? e.paymentId}</span>
                  <Button variant="ghost" size="icon-sm" className="size-6" aria-label="Copy transaction ID" onClick={() => copyText(e.refundId ?? e.paymentId ?? "", "Transaction ID copied")}>
                    <Copy className="size-3" />
                  </Button>
                </span>
              )}
              <span title={SOURCE[e.source]}>· {e.source === "provider" ? "Provider" : e.source === "app" ? "App" : "Inferred"}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
            {e.amountMinor != null && e.currency && <span className="font-mono text-sm font-semibold">{formatMoney(money(e.amountMinor, e.currency as CurrencyCode))}</span>}
            <time dateTime={e.occurredAt} title={timeAgo(e.occurredAt)} className="text-xs text-muted-foreground">
              {formatDate(e.occurredAt, { time: true })}
            </time>
            {showOrder && e.orderId && (
              <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                <Link href={`/sales/orders/${e.orderId}`}>View order</Link>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
