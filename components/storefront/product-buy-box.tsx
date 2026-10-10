"use client";

import { useState } from "react";
import { Download, Link2, Loader2, Minus, Plus, RotateCcw, Share2, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/components/pp/copy-field";
import { CountdownTimer } from "@/components/pp/countdown-timer";
import { MoneyText } from "@/components/pp/money-text";
import { kindLabel } from "@/components/pp/product-card";
import { Stars } from "@/components/pp/stars";
import type { StoreProduct } from "@/lib/api";
import { localPrice } from "@/lib/money";
import type { CurrencyCode, Store } from "@/lib/types";

/** What buyers are told about shipping: free over an amount, the days, or "worked out at checkout" */
function shipLine(store: Store): string {
  const z = store.shipping?.zones.find((x) => x.countries.includes(store.country)) ?? store.shipping?.zones[0];
  if (!z) return "Shipped to you";
  if (z.rate === 0) return z.days ? `Free shipping · ${z.days}` : "Free shipping";
  if (z.freeOver !== undefined) return `Free shipping over ${new Intl.NumberFormat("en-IN", { style: "currency", currency: store.currency, maximumFractionDigits: 0 }).format(z.freeOver / 100)}`;
  return z.days ? `Ships in ${z.days}` : "Shipping at checkout";
}

export function ProductBuyBox({
  product,
  store,
  creatorName,
  currency,
  onBuy,
  buying,
}: {
  product: StoreProduct;
  store: Store;
  creatorName: string;
  currency: CurrencyCode;
  /** With the variant and how many, for physical products */
  onBuy: (choice?: { variantId?: string; quantity: number }) => void;
  buying: boolean;
}) {
  const { rating } = product;
  const physical = product.fulfilment === "physical";
  const options = product.options ?? [];
  const variants = product.variants ?? [];
  // The buyer picks a value for each option; the variant is the one that matches them all
  const [picked, setPicked] = useState<string[]>(() => variants.find((v) => !product.trackStock || (v.stock ?? 0) > 0)?.options ?? variants[0]?.options ?? []);
  const [quantity, setQuantity] = useState(1);
  const variant = variants.find((v) => options.every((_, i) => v.options[i] === picked[i]));
  const left = !physical || !product.trackStock ? undefined : variants.length ? variant?.stock ?? 0 : product.stock ?? 0;
  const soldOut = left !== undefined && left <= 0;
  const info = variant ? { ...product.info, price: variant.price, compareAt: variant.compareAt, percentOff: variant.compareAt ? Math.round((1 - variant.price.amount / variant.compareAt.amount) * 100) : undefined } : product.info;
  /** A value that no in-stock variant has, with what's already picked for the other options */
  const unavailable = (i: number, value: string) => {
    const want = picked.map((p, j) => (j === i ? value : p));
    const match = variants.find((v) => options.every((_, k) => v.options[k] === want[k]));
    return !match || (!!product.trackStock && (match.stock ?? 0) <= 0);
  };
  const url = typeof window === "undefined" ? "" : window.location.href;
  const share = encodeURIComponent(`${product.title} by ${store.name}: ${url}`);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="mt-2 text-[2rem] leading-tight md:text-[2.5rem]">{product.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{kindLabel(product.kind)} · by {creatorName}</p>
        {rating.count > 0 ? (
          <a href="#reviews" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm hover:underline">
            <Stars value={rating.average} /> <span className="font-semibold">{rating.average.toFixed(1)}</span>
            <span className="text-muted-foreground">({rating.count} review{rating.count === 1 ? "" : "s"})</span>
          </a>
        ) : (
          <a href="#reviews" className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground hover:underline">No reviews yet</a>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <MoneyText value={localPrice(info.price, currency)} className="font-display text-[2.25rem] leading-none" />
          {info.compareAt && (
            <>
              <MoneyText value={localPrice(info.compareAt, currency)} className="text-lg text-muted-foreground line-through" />
              <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-sm font-semibold text-danger">{info.percentOff}% off</span>
            </>
          )}
        </div>
        {info.dealEndsAt && (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-accent-ink">
            Deal ends in <CountdownTimer endsAt={info.dealEndsAt} compact />
          </p>
        )}
      </div>

      {physical && options.length > 0 && (
        <div className="flex flex-col gap-4">
          {options.map((o, i) => (
            <fieldset key={o.name} className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">
                {o.name}: <span className="font-normal text-muted-foreground">{picked[i] ?? "Pick one"}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {o.values.map((value) => {
                  const on = picked[i] === value;
                  const off = unavailable(i, value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setPicked(options.map((_, j) => (j === i ? value : picked[j])));
                        setQuantity(1);
                      }}
                      className={`min-h-11 min-w-11 rounded-control border px-3 text-sm font-medium ${on ? "border-primary bg-primary-soft text-primary" : "bg-surface hover:border-border-strong"} ${off ? "text-muted-foreground line-through decoration-1" : ""}`}
                    >
                      {value}
                      {off && <span className="sr-only"> (not available)</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      <div id="main-buy" className="flex flex-col gap-3">
        {physical && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-control border" role="group" aria-label="Quantity">
              <Button type="button" variant="ghost" size="icon" aria-label="One fewer" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Minus /></Button>
              <span className="min-w-10 text-center font-mono" aria-live="polite">{quantity}</span>
              <Button type="button" variant="ghost" size="icon" aria-label="One more" disabled={quantity >= Math.min(99, left ?? 99)} onClick={() => setQuantity(quantity + 1)}><Plus /></Button>
            </span>
            {soldOut ? (
              <span className="text-sm font-semibold text-danger">Sold out</span>
            ) : left !== undefined && left <= 5 ? (
              <span className="text-sm font-medium text-warning-ink">Only {left} left</span>
            ) : null}
          </div>
        )}
        <Button size="lg" className="h-14 w-full text-lg" onClick={() => onBuy(physical ? { variantId: variant?.id, quantity } : undefined)} disabled={buying || soldOut || (variants.length > 0 && !variant)}>
          {buying && <Loader2 className="animate-spin" aria-hidden />}
          {buying ? "Opening checkout…" : soldOut ? "Sold out" : variants.length > 0 && !variant ? "Pick an option" : "Buy now"}
        </Button>
        <ul className="grid grid-cols-1 gap-1.5 text-sm text-muted-foreground sm:grid-cols-3">
          {physical ? (
            <li className="flex items-center gap-1.5"><Truck className="size-4 text-primary" aria-hidden /> {shipLine(store)}</li>
          ) : (
            <li className="flex items-center gap-1.5"><Download className="size-4 text-primary" aria-hidden /> Instant download</li>
          )}
          <li className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-primary" aria-hidden /> Secure payment</li>
          <li className="flex items-center gap-1.5"><RotateCcw className="size-4 text-primary" aria-hidden /> {store.refundDays}-day refunds</li>
        </ul>
        <p className="text-xs text-muted-foreground">Have a code? Apply it at checkout.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <span className="mr-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Share2 className="size-4" aria-hidden /> Share</span>
        <Button asChild variant="secondary" size="sm"><a href={`https://wa.me/?text=${share}`} target="_blank" rel="noreferrer">WhatsApp</a></Button>
        <Button asChild variant="secondary" size="sm"><a href={`https://twitter.com/intent/tweet?text=${share}`} target="_blank" rel="noreferrer">X</a></Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ title: product.title, url });
                return;
              } catch {
                /* cancelled: fall through to copy */
              }
            }
            await copyText(url, "Link copied");
          }}
        >
          <Link2 aria-hidden /> Copy link
        </Button>
      </div>
    </div>
  );
}
