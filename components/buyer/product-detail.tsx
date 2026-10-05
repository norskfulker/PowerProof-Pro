"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { kindLabel } from "@/components/pp/product-card";
import { ProductImageView } from "@/components/pp/product-cover";
import { MoneyText } from "@/components/pp/money-text";
import { formatBytes, localPrice } from "@/lib/money";
import type { CurrencyCode, Product, Store } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConversionNote, TrustBar } from "./buyer-shell";

export function BuyButton({ onBuy, pending, product, currency, className }: { onBuy: () => void; pending: boolean; product: Product; currency: CurrencyCode; className?: string }) {
  return (
    <Button size="lg" className={cn("w-full", className)} onClick={onBuy} disabled={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? "Opening checkout…" : <>Buy for <MoneyText value={localPrice(product.price, currency)} /></>}
    </Button>
  );
}

export function ProductDetail({
  product,
  store,
  currency,
  onBuy,
  pending,
}: {
  product: Product;
  store: Store;
  currency: CurrencyCode;
  onBuy: () => void;
  pending: boolean;
}) {
  const [active, setActive] = useState(0);
  const price = localPrice(product.price, currency);
  return (
    <div className="grid grid-cols-1 gap-8 pb-24 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-10 md:pb-0">
      <div className="flex flex-col gap-3">
        <ProductImageView image={product.images[active]} size="lg" className="rounded-card" />
        {product.images.length > 1 && (
          <div className="flex gap-2" role="group" aria-label="Product images">
            {product.images.map((img, i) => (
              <button key={img.id} type="button" onClick={() => setActive(i)} aria-label={`Show image ${i + 1}`} aria-pressed={i === active}
                className={cn("w-20 overflow-hidden rounded-media", i === active ? "outline-2 outline-offset-2 outline-primary" : "opacity-70 hover:opacity-100")}>
                <ProductImageView image={img} size="xs" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <p className="eyebrow">{kindLabel(product.kind)} · by {store.name}</p>
          <h1 className="mt-2 text-[32px] leading-tight md:text-[40px]">{product.title}</h1>
        </div>
        <div className="flex items-baseline gap-3">
          <MoneyText value={price} className="font-display text-[32px]" />
          {product.compareAt && <MoneyText value={localPrice(product.compareAt, currency)} className="text-lg text-muted-foreground line-through" />}
        </div>
        {currency !== "INR" && <ConversionNote currency={currency} className="-mt-3" />}
        <BuyButton onBuy={onBuy} pending={pending} product={product} currency={currency} className="max-md:hidden" />
        <TrustBar refundDays={store.refundDays} />
        <div className="text-base leading-relaxed whitespace-pre-line text-foreground/90">{product.description}</div>
        {product.files.length > 0 && (
          <section aria-labelledby="whats-in" className="rounded-card border bg-surface p-4">
            <h2 id="whats-in" className="eyebrow mb-3">What you get</h2>
            <ul className="flex flex-col gap-2">
              {product.files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section aria-labelledby="refund-h" className="text-sm text-muted-foreground">
          <h2 id="refund-h" className="mb-1 font-sans text-sm font-semibold tracking-normal text-foreground">Refunds</h2>
          {store.refundPolicy}
        </section>
      </div>

      {/* Sticky buy bar on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:hidden">
        <BuyButton onBuy={onBuy} pending={pending} product={product} currency={currency} />
      </div>
    </div>
  );
}
