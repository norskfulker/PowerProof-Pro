"use client";

import { useState } from "react";
import { CurrencyInput } from "@/components/pp/currency-input";
import { MoneyText } from "@/components/pp/money-text";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { convert, feeBreakdown, money, PRICING } from "@/lib/money";
import type { Money } from "@/lib/types";

/** Sale price + monthly volume → what you keep, per sale and per month. */
export function FeeCalculator() {
  const [price, setPrice] = useState<Money | undefined>(money(99900));
  const [count, setCount] = useState(40);
  const [firstMonth, setFirstMonth] = useState(false);

  const sale = price ?? money(0);
  const per = feeBreakdown(sale);
  const subscription = firstMonth ? money(0) : convert(money(PRICING.monthlyUsd, "USD"), "INR");
  const gross = money(sale.amount * count);
  const fees = money((per.gateway.amount + per.platform.amount) * count);
  const keep = money(per.keep.amount * count - subscription.amount);
  const invalid = price !== undefined && price.amount < 1000;

  return (
    <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-dialog border bg-surface lg:grid-cols-2">
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calc-price">Your price</Label>
          <CurrencyInput id="calc-price" value={price} onChange={setPrice} invalid={invalid} aria-describedby="calc-price-help" />
          <p id="calc-price-help" className={invalid ? "text-sm font-medium text-danger" : "text-sm text-muted-foreground"}>
            {invalid ? "Prices start at ₹10.00." : "What a buyer in India pays. Buyers abroad see it in their currency."}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="calc-count">Sales per month</Label>
            <output htmlFor="calc-count" className="font-display text-2xl tabular">{count}</output>
          </div>
          <input
            id="calc-count"
            type="range"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-11 w-full cursor-pointer accent-primary"
          />
          <div className="flex justify-between font-mono text-[0.6875rem] text-muted-foreground">
            <span>1</span>
            <span>500</span>
          </div>
        </div>
        <label className="flex min-h-11 items-center justify-between gap-4 rounded-control border px-4">
          <span className="text-sm">
            <span className="font-medium">First month</span>
            <span className="block text-muted-foreground">No subscription fee</span>
          </span>
          <Switch checked={firstMonth} onCheckedChange={setFirstMonth} aria-label="Calculate for the free first month" />
        </label>
      </div>

      <div className="flex flex-col gap-5 border-t bg-surface-sunken p-6 md:p-8 lg:border-t-0 lg:border-l" aria-live="polite">
        <p className="eyebrow">Per sale</p>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Price</dt>
          <dd className="text-right"><MoneyText value={sale} mono /></dd>
          <dt className="text-muted-foreground">Gateway (~{PRICING.gatewayFeePct}%)</dt>
          <dd className="text-right"><MoneyText value={{ ...per.gateway, amount: -per.gateway.amount }} mono /></dd>
          <dt className="text-muted-foreground">PowerProof ({PRICING.platformFeePct}%)</dt>
          <dd className="text-right"><MoneyText value={{ ...per.platform, amount: -per.platform.amount }} mono /></dd>
          <dt className="font-semibold">You keep</dt>
          <dd className="text-right"><MoneyText value={per.keep} mono className="font-semibold" /></dd>
        </dl>
        <p className="eyebrow mt-2">Per month</p>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
          <dt className="text-muted-foreground">{count} sales</dt>
          <dd className="text-right"><MoneyText value={gross} mono /></dd>
          <dt className="text-muted-foreground">Fees</dt>
          <dd className="text-right"><MoneyText value={{ ...fees, amount: -fees.amount }} mono /></dd>
          <dt className="text-muted-foreground">Subscription ($20)</dt>
          <dd className="text-right"><MoneyText value={{ ...subscription, amount: -subscription.amount }} mono /></dd>
        </dl>
        <div className="mt-auto border-t border-dashed border-border-strong pt-4">
          <p className="text-sm font-semibold">You keep each month</p>
          <MoneyText value={keep} className="font-display text-[2.5rem] leading-tight text-accent-strong" />
          <p className="mt-1 text-xs text-muted-foreground">
            $20 shown at ₹83.40 per dollar. International cards may cost a little more at the gateway.
          </p>
        </div>
      </div>
    </div>
  );
}
