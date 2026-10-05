"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { requestRefund } from "@/lib/api";
import type { Order, Store } from "@/lib/types";

export function RefundRequest({ order, store, onDone }: { order: Order; store: Store; onDone: (o: Order) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [now] = useState(() => Date.now());
  const withinWindow = !!order.paidAt && now - Date.parse(order.paidAt) < store.refundDays * 86400000;

  if (order.status === "refund_requested") {
    return <p className="text-sm text-muted-foreground">You asked for a refund. {store.name} usually replies within two working days.</p>;
  }
  if (order.status === "refunded") return <p className="text-sm text-muted-foreground">This order was refunded.</p>;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">Ask for a refund</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Ask for a refund</SheetTitle>
          <SheetDescription>
            {withinWindow ? store.refundPolicy : `This order is outside the ${store.refundDays}-day window. You can still ask; ${store.name} decides.`}
          </SheetDescription>
        </SheetHeader>
        <form
          id="refund"
          noValidate
          className="flex flex-col gap-2 px-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (reason.trim().length < 5) return setError("A few words help the creator sort it out faster.");
            setPending(true);
            try {
              const o = await requestRefund(order.token, reason.trim());
              onDone(o);
              setOpen(false);
              toast.success("Request sent", { description: `${store.name} will reply by email.` });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't send.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Label htmlFor="rr-reason">What went wrong?</Label>
          <Textarea id="rr-reason" rows={4} value={reason} onChange={(e) => { setReason(e.target.value); setError(undefined); }} aria-invalid={!!error || undefined} aria-describedby="rr-err" />
          {error && <p id="rr-err" role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </form>
        <SheetFooter>
          <Button type="submit" form="refund" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Send request</Button>
          <Button asChild variant="ghost"><a href={`mailto:${store.supportEmail}?subject=Order ${order.number}`}>Email {store.name} instead</a></Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
