"use client";

import { MoneyText } from "@/components/pp/money-text";
import { discountPercent } from "@/lib/money";
import type { Money } from "@/lib/types";

/**
 * The price as a buyer reads it, inside the discount box: the price, the original crossed out and
 * the "% off" badge. It is the same line the store card and the product page show.
 */
export function PricePreview({ price, compareAt }: { price: Money; compareAt?: Money }) {
  const percent = discountPercent(price, compareAt);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-control bg-surface px-3 py-2.5" aria-label="How the discount looks" data-slot="discount-preview">
      <MoneyText value={price} className="font-display text-2xl leading-none" />
      {percent > 0 && compareAt ? (
        <>
          <MoneyText value={compareAt} className="text-base text-muted-foreground line-through" />
          <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-sm font-semibold text-danger">{percent}% off</span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">Set an original price above this one to show a discount.</span>
      )}
    </div>
  );
}
