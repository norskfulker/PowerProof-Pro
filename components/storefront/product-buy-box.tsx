"use client";

import { Download, Link2, Loader2, RotateCcw, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/components/pp/copy-field";
import { CountdownTimer } from "@/components/pp/countdown-timer";
import { MoneyText } from "@/components/pp/money-text";
import { kindLabel } from "@/components/pp/product-card";
import { Stars } from "@/components/pp/stars";
import { ConversionNote } from "@/components/buyer/buyer-shell";
import type { StoreProduct } from "@/lib/api";
import { localPrice } from "@/lib/money";
import type { CurrencyCode, Store } from "@/lib/types";

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
  onBuy: () => void;
  buying: boolean;
}) {
  const { info, rating } = product;
  const url = typeof window === "undefined" ? "" : window.location.href;
  const share = encodeURIComponent(`${product.title} by ${store.name}: ${url}`);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">{kindLabel(product.kind)} · by {creatorName}</p>
        <h1 className="mt-2 text-[32px] leading-tight md:text-[40px]">{product.title}</h1>
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
          <MoneyText value={localPrice(info.price, currency)} className="font-display text-[36px] leading-none" />
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
        <ConversionNote currency={currency} className="mt-2" />
      </div>

      <div id="main-buy" className="flex flex-col gap-3">
        <Button size="lg" className="h-14 w-full text-lg" onClick={onBuy} disabled={buying}>
          {buying && <Loader2 className="animate-spin" aria-hidden />}
          {buying ? "Opening checkout…" : "Buy now"}
        </Button>
        <ul className="grid grid-cols-1 gap-1.5 text-sm text-muted-foreground sm:grid-cols-3">
          <li className="flex items-center gap-1.5"><Download className="size-4 text-primary" aria-hidden /> Instant download</li>
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
