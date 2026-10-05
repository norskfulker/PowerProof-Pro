"use client";

import { useState } from "react";
import { Loader2, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyText } from "@/components/pp/money-text";
import { ProductImageView } from "@/components/pp/product-cover";
import { checkoutLines } from "@/lib/pricing";
import type { Order, Product } from "@/lib/types";

/** Right-hand order summary: items, discount, tax line and total, all in the buyer's currency. */
export function CheckoutSummary({ order, products }: { order: Order; products: Product[] }) {
  const lines = checkoutLines(order);
  const intl = order.countryCode !== "IN";
  return (
    <section aria-label="Order summary" className="rounded-card border bg-surface">
      <ul className="divide-y">
        {order.items.map((it, i) => {
          const p = products.find((x) => x.id === it.productId);
          return (
            <li key={`${it.productId}-${it.kind}-${it.gift ? "gift" : ""}`} className="flex items-center gap-3 p-4">
              <ProductImageView image={p?.images[0]} size="xs" className="w-16 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium [overflow-wrap:anywhere]">{it.title}</span>
                <span className="text-xs text-muted-foreground">{it.gift ? "Free gift" : it.kind === "bump" ? "Add-on" : it.kind === "bundle" ? "Bundle item" : it.kind === "deal" ? "Added from deals" : "Instant download"}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                {lines.items[i].base.amount !== lines.items[i].amount.amount && (
                  <s className="text-xs text-muted-foreground"><MoneyText value={lines.items[i].base} mono /></s>
                )}
                {lines.items[i].free ? <span className="font-semibold text-success">Free</span> : <MoneyText value={lines.items[i].amount} mono />}
              </span>
            </li>
          );
        })}
      </ul>
      <dl className="flex flex-col gap-2 border-t border-dashed border-border-strong p-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd><MoneyText value={lines.subtotal} mono /></dd></div>
        {lines.dealSaving.amount > 0 && (
          <div className="flex justify-between text-success"><dt>Deal savings</dt><dd><MoneyText value={{ ...lines.dealSaving, amount: -lines.dealSaving.amount }} mono /></dd></div>
        )}
        {lines.discount.amount > 0 && (
          <div className="flex justify-between gap-3 text-success"><dt className="min-w-0 break-all">{order.couponCode ? `Coupon (${order.couponCode})` : "Discount"}</dt><dd className="shrink-0"><MoneyText value={{ ...lines.discount, amount: -lines.discount.amount }} mono /></dd></div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{intl ? "Tax" : "GST (included)"}</dt>
          <dd>{intl ? <span className="font-mono text-[0.8125rem]">Nil, export</span> : <MoneyText value={lines.tax} mono />}</dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between border-t pt-3">
          <dt className="font-semibold">Total</dt>
          <dd><MoneyText value={lines.total} className="font-display text-2xl" /></dd>
        </div>
      </dl>
    </section>
  );
}

export function CouponField({ applied, onApply, onRemove }: { applied?: string; onApply: (code: string) => Promise<void>; onRemove: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (applied) {
    return (
      <div className="flex items-center gap-2 rounded-control border border-success/40 bg-success-soft px-3.5 py-2 text-sm" role="status">
        <Tag className="size-4 text-success" aria-hidden />
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><span className="font-mono font-semibold break-all">{applied}</span> applied</span>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}><X aria-hidden /> Remove</Button>
      </div>
    );
  }
  if (!open) {
    return <Button type="button" variant="link" className="self-start" onClick={() => setOpen(true)}><Tag aria-hidden /> Have a coupon code?</Button>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="coupon">Coupon code</Label>
      <div className="flex gap-2">
        <Input
          id="coupon"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(undefined); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLButtonElement)?.click(); } }}
          className="font-mono uppercase"
          aria-invalid={!!error || undefined}
          aria-describedby="coupon-e"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !code.trim()}
          onClick={async () => {
            setPending(true);
            try {
              await onApply(code);
              setCode("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "That code didn't work.");
            } finally {
              setPending(false);
            }
          }}
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />} Apply
        </Button>
      </div>
      {error && <p id="coupon-e" role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
