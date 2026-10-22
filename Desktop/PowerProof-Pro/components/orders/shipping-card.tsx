"use client";

import { useState } from "react";
import { Copy, ExternalLink, HandCoins, Loader2, PackageCheck, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { copyText } from "@/components/pp/copy-field";
import { MoneyText } from "@/components/pp/money-text";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fulfilOrder, type FulfilInput } from "@/lib/api";
import { countryShort } from "@/lib/format";
import type { Order } from "@/lib/types";

/** Couriers creators in India use most, for the "Shipped" form */
const CARRIERS = ["India Post", "Delhivery", "Blue Dart", "DTDC", "Ekart", "Xpressbees", "Shadowfax", "Ecom Express"];

const addressText = (a: NonNullable<Order["shipTo"]>) => [a.name, a.line1, a.line2, `${a.city}${a.state ? `, ${a.state}` : ""} ${a.pincode}`, countryShort(a.country), `Phone ${a.phone}`].filter(Boolean).join("\n");

/**
 * Where a physical order goes and how far it's got: the address (to copy onto the parcel), then
 * one step at a time: shipped (with tracking), delivered, cash collected, or cancelled.
 */
export function ShippingCard({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const [shipping, setShipping] = useState(false);
  const [form, setForm] = useState({ carrier: order.tracking?.carrier ?? "", number: order.tracking?.number ?? "", url: order.tracking?.url ?? "", notify: true });
  const [busy, setBusy] = useState<FulfilInput["step"]>();
  const [confirm, setConfirm] = useState<"cancelled" | "cod_paid">();
  const cod = order.status === "cod";
  const live = order.status === "paid" || cod;
  const step = order.fulfilment;

  async function run(input: FulfilInput, done: string) {
    setBusy(input.step);
    try {
      const next = await fulfilOrder(order.id, input);
      onChange(next);
      toast.success(done);
    } catch (e) {
      toast.error("That didn't save", { description: e instanceof Error ? e.message : undefined });
      throw e;
    } finally {
      setBusy(undefined);
    }
  }

  const items = order.items.filter((i) => i.physical);
  return (
    <section className="rounded-card border bg-surface p-5 md:p-6" aria-labelledby="ship-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ship-h" className="font-sans text-base font-semibold tracking-normal">Shipping</h2>
        {step && <StatusPill status={step} />}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Send to</p>
          {order.shipTo ? (
            <>
              <address className="mt-1 text-sm whitespace-pre-line not-italic">{addressText(order.shipTo)}</address>
              <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => copyText(addressText(order.shipTo!), "Address copied")}>
                <Copy aria-hidden /> Copy address
              </Button>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No address on this order.</p>
          )}
        </div>
        <div>
          <p className="eyebrow">In the parcel</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {items.map((i) => (
              <li key={`${i.productId}-${i.variant ?? ""}`} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {i.title}
                  {i.variant && <span className="text-muted-foreground"> · {i.variant}</span>}
                </span>
                <span className="shrink-0 font-mono">× {i.quantity ?? 1}</span>
              </li>
            ))}
          </ul>
          {order.shipping && (
            <p className="mt-2 text-sm text-muted-foreground">
              Buyer paid {order.shipping.amount ? <MoneyText value={order.shipping} /> : "nothing"} for shipping
              {order.codFee ? (
                <>
                  {" "}and <MoneyText value={order.codFee} /> for cash on delivery
                </>
              ) : null}
              .
            </p>
          )}
        </div>
      </div>

      {order.tracking && (order.tracking.carrier || order.tracking.number) && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <Truck className="size-4 text-muted-foreground" aria-hidden />
          {[order.tracking.carrier, order.tracking.number].filter(Boolean).join(" · ")}
          {order.tracking.url && (
            <a href={order.tracking.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
              Track <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </p>
      )}

      {cod && (
        <p className="mt-4 rounded-control border border-info/30 bg-info-soft px-3 py-2 text-sm" role="note">
          <strong>Cash on delivery.</strong> Collect <MoneyText value={order.buyerTotal} /> when it&apos;s delivered, then mark the cash as collected.
        </p>
      )}

      {live && step && step !== "cancelled" && step !== "delivered" && (
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          {step === "unfulfilled" && (
            <Button type="button" onClick={() => setShipping(true)} disabled={!!busy}>
              <Truck aria-hidden /> Mark as shipped
            </Button>
          )}
          {step === "shipped" && !cod && (
            <Button type="button" onClick={() => run({ step: "delivered" }, "Marked as delivered")} disabled={!!busy}>
              {busy === "delivered" ? <Loader2 className="animate-spin" aria-hidden /> : <PackageCheck aria-hidden />} Mark as delivered
            </Button>
          )}
          {step === "shipped" && (
            <Button type="button" variant="secondary" onClick={() => setShipping(true)} disabled={!!busy}>
              Edit tracking
            </Button>
          )}
          {cod && (
            <Button type="button" variant={step === "shipped" ? "primary" : "secondary"} onClick={() => setConfirm("cod_paid")} disabled={!!busy}>
              <HandCoins aria-hidden /> Delivered, cash collected
            </Button>
          )}
          {cod && (
            <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirm("cancelled")} disabled={!!busy}>
              <XCircle aria-hidden /> Cancel order
            </Button>
          )}
        </div>
      )}

      <Dialog open={shipping} onOpenChange={(o) => !busy && setShipping(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{step === "shipped" ? "Edit tracking" : "Mark as shipped"}</DialogTitle>
            <DialogDescription>Tracking is optional, but buyers like to see where their parcel is.</DialogDescription>
          </DialogHeader>
          <form
            id="ship-form"
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await run({ step: "shipped", carrier: form.carrier, number: form.number, url: form.url, notify: form.notify }, form.notify ? "Marked as shipped. The buyer gets an email." : "Marked as shipped");
              setShipping(false);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sh-carrier">Courier</Label>
              <Input id="sh-carrier" list="sh-carriers" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="Delhivery" />
              <datalist id="sh-carriers">{CARRIERS.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sh-number">Tracking number</Label>
              <Input id="sh-number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="font-mono" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sh-url">Tracking link <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="sh-url" type="url" inputMode="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" aria-invalid={!!form.url && !/^https:\/\//.test(form.url) || undefined} />
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={form.notify} onCheckedChange={(v) => setForm({ ...form, notify: v === true })} />
              Email the buyer
            </label>
          </form>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setShipping(false)} disabled={!!busy}>Cancel</Button>
            <Button type="submit" form="ship-form" disabled={!!busy || (!!form.url && !/^https:\/\//.test(form.url))}>
              {busy === "shipped" && <Loader2 className="animate-spin" aria-hidden />} {step === "shipped" ? "Save" : "Mark as shipped"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        title={confirm === "cod_paid" ? "Delivered and cash collected?" : `Cancel ${order.number}?`}
        description={
          confirm === "cod_paid"
            ? "The order becomes paid and gets its invoice. PowerProof's fee is taken from your balance, since the cash came to you."
            : "Use this when the parcel wasn't delivered or the buyer refused it. No cash changes hands and the stock goes back."
        }
        confirmLabel={confirm === "cod_paid" ? "Yes, cash collected" : "Cancel the order"}
        onConfirm={() => run({ step: confirm! }, confirm === "cod_paid" ? "Paid on delivery" : "Order cancelled")}
      />
    </section>
  );
}
