"use client";

import { useState } from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CREDIT_PRICE, creditsCostMinor } from "@/lib/agents/define";
import { confirmCreditPurchase, startCreditPurchase } from "@/lib/api/agents";
import { formatNumber } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

interface CreditsRazorpayWindow {
  Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | undefined;
function loadRazorpay(): Promise<void> {
  const w = window as unknown as CreditsRazorpayWindow;
  if (w.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = undefined;
      reject(new Error("The payment window couldn't load. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

const PICKS = [100, 250, 500, 1000, 2500];
const usd = (minor: number) => formatMoney({ amount: minor, currency: CREDIT_PRICE.currency });
const PER = usd(CREDIT_PRICE.perCreditMinor);
const clamp = (n: number) => Math.min(CREDIT_PRICE.max, Math.max(CREDIT_PRICE.min, Math.round(n)));

/** What a credit is, in one line, wherever credits are explained */
export const CREDIT_RULE = "One credit is one finished piece of work, like one reminder sent. If a run fails, its credit comes back.";

/**
 * Buy any number of credits at one flat price: type a number, step it, or pick a common amount,
 * and the total follows. Paying opens Razorpay's window; the credits land once it's confirmed.
 */
export function BuyCredits({ open, onOpenChange, workspaceName, onBought }: { open: boolean; onOpenChange: (o: boolean) => void; workspaceName?: string; onBought?: () => void }) {
  const [text, setText] = useState("500");
  const [pending, setPending] = useState(false);
  const raw = Number(text);
  const valid = text.trim() !== "" && Number.isInteger(raw) && raw >= CREDIT_PRICE.min && raw <= CREDIT_PRICE.max;
  const n = valid ? raw : clamp(Number.isFinite(raw) ? raw : CREDIT_PRICE.min);
  const total = usd(creditsCostMinor(n));
  const set = (v: number) => setText(String(clamp(v)));

  const pay = async () => {
    if (!valid) return;
    setPending(true);
    try {
      const order = await startCreditPurchase(n);
      await loadRazorpay();
      const Razorpay = (window as unknown as CreditsRazorpayWindow).Razorpay!;
      // Close ours first so Razorpay's window isn't stacked under it
      onOpenChange(false);
      const rz = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountMinor,
        currency: order.currency,
        name: "PowerProof Agents",
        description: `${formatNumber(n)} credits at ${PER} each`,
        theme: { color: "#0F3D33" },
        modal: { ondismiss: () => setPending(false) },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const done = await confirmCreditPurchase({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
            toast.success(`${formatNumber(done.credits)} credits added`, { description: `Shared by every store and agent in ${workspaceName ?? "this workspace"}.` });
            onBought?.();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "We couldn't confirm that payment.", { description: "If you were charged, the credits are added as soon as it's confirmed. Contact support with your payment id." });
          }
          setPending(false);
        },
      });
      rz.on("payment.failed", (r) => {
        toast.error(r.error?.description ?? "The payment didn't go through. You haven't been charged.");
        setPending(false);
      });
      rz.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't start that payment.");
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Buy credits</DialogTitle>
          <DialogDescription>Pick any number. Each credit is {PER}, with no packs and no expiry.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void pay();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="credits-n">How many credits</Label>
            <div className="flex items-stretch gap-2">
              <Button type="button" variant="secondary" size="icon" aria-label="Fewer credits" onClick={() => set(n - (n > 1000 ? 100 : 10))} disabled={n <= CREDIT_PRICE.min}>
                <Minus aria-hidden />
              </Button>
              <Input
                id="credits-n"
                inputMode="numeric"
                className="h-11 text-center font-mono text-lg tabular"
                value={text}
                onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                onBlur={() => set(n)}
                aria-invalid={!valid || undefined}
                aria-describedby="credits-help"
              />
              <Button type="button" variant="secondary" size="icon" aria-label="More credits" onClick={() => set(n + (n >= 1000 ? 100 : 10))} disabled={n >= CREDIT_PRICE.max}>
                <Plus aria-hidden />
              </Button>
            </div>
            <input
              type="range"
              aria-label="Credits"
              min={CREDIT_PRICE.min}
              max={5000}
              step={10}
              value={Math.min(n, 5000)}
              onChange={(e) => setText(e.target.value)}
              className="w-full accent-[var(--primary)]"
            />
            <div role="group" aria-label="Common amounts" className="flex flex-wrap gap-2">
              {PICKS.map((p) => (
                <button key={p} type="button" aria-pressed={valid && raw === p} onClick={() => set(p)} className={cn("min-h-9 rounded-md border px-3 font-mono text-sm transition-colors pointer-coarse:min-h-11", valid && raw === p ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:border-primary")}>
                  {formatNumber(p)}
                </button>
              ))}
            </div>
            <p id="credits-help" className={cn("text-xs", valid ? "text-muted-foreground" : "font-medium text-danger")}>
              {valid ? `From ${CREDIT_PRICE.min} to ${formatNumber(CREDIT_PRICE.max)} credits.` : `Pick between ${CREDIT_PRICE.min} and ${formatNumber(CREDIT_PRICE.max)} credits.`}
            </p>
          </div>

          <dl className="flex flex-col gap-1 rounded-control bg-surface-sunken p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{formatNumber(n)} credits × {PER}</dt><dd className="font-mono tabular">{total}</dd></div>
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2"><dt className="font-semibold">Total</dt><dd className="font-display text-2xl font-bold tabular">{total}</dd></div>
          </dl>

          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> One credit pays for one finished task, like one reminder sent.</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> Failed tasks don&apos;t count: the credit comes back.</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> Shared by every store and agent in {workspaceName ?? "this workspace"}.</li>
          </ul>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={!valid || pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Pay {total}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
