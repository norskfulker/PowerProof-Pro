"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/pp/currency-input";
import { MoneyText } from "@/components/pp/money-text";
import { PayoutMethodCard } from "@/components/pp/payout-method-card";
import { MIN_WITHDRAWAL, requestPayout } from "@/lib/api";
import { money } from "@/lib/money";
import type { Balance, Money, Payout, PayoutMethod } from "@/lib/types";

/**
 * Withdraw flow. Money leaving the account is the one non-destructive action that still
 * gets a dialog: it asks for an amount and a destination and confirms before sending.
 */
export function WithdrawDialog({
  open,
  onOpenChange,
  balance,
  methods,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  balance: Balance;
  methods: PayoutMethod[];
  onDone: (p: Payout) => void;
}) {
  const available = balance.available.amount;
  const [amount, setAmount] = useState<Money | undefined>(balance.available);
  const [methodId, setMethodId] = useState(methods.find((m) => m.primary)?.id ?? methods[0]?.id);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<Payout>();

  const reset = () => {
    setAmount(balance.available);
    setError(undefined);
    setSent(undefined);
  };

  async function submit() {
    if (!amount || amount.amount < MIN_WITHDRAWAL) return setError("The smallest withdrawal is ₹100.00.");
    if (amount.amount > available) return setError("That's more than your available balance.");
    if (!methodId) return setError("Add a payout method first.");
    setError(undefined);
    setPending(true);
    try {
      const p = await requestPayout(amount, methodId);
      setSent(p);
      onDone(p);
      toast.success("Payout on its way", { description: `${p.methodLabel}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        onOpenChange(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
            <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success"><Check className="size-6" aria-hidden /></span>
            <DialogTitle className="font-display text-2xl">Money&apos;s on the move</DialogTitle>
            <DialogDescription>
              <MoneyText value={sent.amount} className="font-semibold text-foreground" /> to {sent.methodLabel}. Usually lands within a few hours; banks can take until the next working day.
            </DialogDescription>
            <Button className="mt-2 w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Withdraw</DialogTitle>
              <DialogDescription>
                You have <MoneyText value={balance.available} className="font-semibold text-foreground" /> available.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wd-amount">Amount</Label>
                <CurrencyInput id="wd-amount" value={amount} onChange={setAmount} invalid={!!error} aria-describedby="wd-err" />
                <div className="flex flex-wrap gap-2">
                  {[0.25, 0.5, 1].map((f) => (
                    <Button key={f} type="button" size="sm" variant="secondary" onClick={() => setAmount(money(Math.floor(available * f)))}>
                      {f === 1 ? "All of it" : `${f * 100}%`}
                    </Button>
                  ))}
                </div>
                {error && <p id="wd-err" role="alert" className="text-sm font-medium text-danger">{error}</p>}
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-sm font-medium">Send to</legend>
                {methods.map((m) => (
                  <PayoutMethodCard key={m.id} method={m} selected={methodId === m.id} onSelect={() => setMethodId(m.id)} />
                ))}
              </fieldset>
              {methods.find((m) => m.id === methodId)?.kind === "crypto" ? (
                <p className="text-sm text-muted-foreground">Sent as {methods.find((m) => m.id === methodId)?.asset} on {methods.find((m) => m.id === methodId)?.network}. The amount you receive in crypto depends on the rate when it is sent. Crypto transfers can&apos;t be undone, so check the address.</p>
              ) : (
                <p className="text-sm text-muted-foreground">No fee for withdrawals. You&apos;ll get an email when it lands.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
              <Button onClick={submit} disabled={pending || !methodId}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Withdraw {amount ? <MoneyText value={amount} /> : null}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
