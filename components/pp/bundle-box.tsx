"use client";

import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localPrice } from "@/lib/money";
import type { CurrencyCode, Money, Product } from "@/lib/types";
import { MoneyText } from "./money-text";
import { ProductImageView } from "./product-cover";

/** "Frequently bought together": the bundle's products, combined price and one button. */
export function BundleBox({
  name,
  products,
  full,
  price,
  percentOff,
  currency,
  hrefFor,
  onBuy,
  buying,
}: {
  name: string;
  products: Product[];
  full: Money;
  price: Money;
  percentOff: number;
  currency: CurrencyCode;
  hrefFor: (p: Product) => string;
  onBuy: () => void;
  buying?: boolean;
}) {
  return (
    <section aria-label={`Bundle: ${name}`} className="rounded-card border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-sans text-base font-semibold tracking-normal">Frequently bought together</h3>
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">Save {percentOff}%</span>
      </div>
      <ul className="mt-4 flex flex-wrap items-center gap-2">
        {products.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2">
            {i > 0 && <Plus className="size-4 text-muted-foreground" aria-hidden />}
            <Link href={hrefFor(p)} className="block w-20 rounded-media" aria-label={p.title}>
              <ProductImageView image={p.images[0]} size="xs" />
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {products.map((p) => (
          <li key={p.id} className="truncate text-muted-foreground">· {p.title}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="flex items-baseline gap-2">
          <MoneyText value={localPrice(price, currency)} className="font-display text-2xl" />
          <MoneyText value={localPrice(full, currency)} className="text-sm text-muted-foreground line-through" />
        </span>
        <Button onClick={onBuy} disabled={buying}>
          {buying && <Loader2 className="animate-spin" aria-hidden />}
          Buy bundle
        </Button>
      </div>
    </section>
  );
}
