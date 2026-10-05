"use client";

import { Loader2, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MoneyText } from "@/components/pp/money-text";
import type { Money, Order } from "@/lib/types";

const METHOD_COPY: Record<Order["paymentMethod"], string> = {
  upi: "Approve the request in your UPI app (GPay, PhonePe, Paytm, BHIM).",
  card: "Your bank may ask for a one-time password.",
  netbanking: "You'll be sent to your bank's page to log in.",
  wallet: "Confirm in your wallet app.",
};

/**
 * Stand-in for the payment gateway's own secure checkout (Razorpay in production).
 * PowerProof never renders card fields itself; this sheet mimics the hand-off.
 */
export function MockGateway({
  open,
  onOpenChange,
  amount,
  method,
  pending,
  onApprove,
  onDecline,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  amount: Money;
  method: Order["paymentMethod"];
  pending: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-dialog px-0 sm:bottom-6 sm:rounded-dialog">
        <SheetHeader className="px-6">
          <p className="eyebrow flex items-center gap-1.5"><Lock className="size-3" aria-hidden /> Secure payment · test mode</p>
          <SheetTitle className="font-display text-2xl">
            Pay <MoneyText value={amount} />
          </SheetTitle>
          <SheetDescription>{METHOD_COPY[method]}</SheetDescription>
        </SheetHeader>
        <div className="mx-6 flex items-center gap-3 rounded-card border bg-surface-sunken p-4 text-sm" aria-live="polite">
          {pending ? (
            <>
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
              Waiting for your bank…
            </>
          ) : (
            <>
              <Smartphone className="size-5 text-primary" aria-hidden />
              This is a preview. Choose what the bank says.
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 px-6 pb-6">
          <Button size="lg" onClick={onApprove} disabled={pending}>
            <ShieldCheck aria-hidden /> Approve payment
          </Button>
          <Button variant="ghost" onClick={onDecline} disabled={pending}>
            Simulate a declined payment
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
