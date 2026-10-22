"use client";

import Link from "next/link";
import { Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localPrice } from "@/lib/money";
import type { CurrencyCode, PriceInfo, Product, RatingSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MoneyText } from "./money-text";
import { kindLabel } from "./product-card";
import { ProductImageView } from "./product-cover";
import { Stars } from "./stars";

export interface CardProduct extends Product {
  info: PriceInfo;
  rating: RatingSummary;
}

/** Store grid card: image, title, stars, local price, discount badge and Buy now. */
export function StoreProductCard({
  product,
  href,
  currency,
  onBuy,
  buying,
  className,
}: {
  product: CardProduct;
  href: string;
  currency: CurrencyCode;
  onBuy?: () => void;
  buying?: boolean;
  className?: string;
}) {
  const { info, rating } = product;
  const price = localPrice(info.price, currency);
  const was = info.compareAt ? localPrice(info.compareAt, currency) : undefined;
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-card border bg-surface transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift",
        className
      )}
    >
      {/* The picture runs to the card's edges and eases in a little on hover */}
      <Link href={href} className="relative block overflow-hidden bg-muted" tabIndex={-1} aria-hidden>
        <ProductImageView
          image={product.images[0]}
          fallback={product.tileBackground}
          fallbackLabel={product.title}
          className="rounded-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
        <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {info.dealEndsAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[0.6875rem] font-semibold text-accent-foreground shadow-xs">
              <Timer className="size-3" /> Deal
            </span>
          )}
          {info.percentOff ? <span className="rounded-full bg-foreground px-2.5 py-1 text-[0.6875rem] font-semibold text-background shadow-xs">−{info.percentOff}%</span> : null}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">{kindLabel(product.kind)}</span>
          {rating.count > 0 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Stars value={rating.average} />
              <span className="tabular">{rating.average.toFixed(1)} ({rating.count})</span>
            </span>
          ) : (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-primary">New</span>
          )}
        </div>
        <h3 className="font-sans text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em]">
          <Link href={href} className="line-clamp-2 after:absolute after:inset-0 after:content-['']">{product.title}</Link>
        </h3>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <span className="flex items-baseline gap-2">
            <MoneyText value={price} className="font-display text-lg font-bold tracking-[-0.02em]" />
            {was && <MoneyText value={was} className="text-sm text-muted-foreground line-through" />}
          </span>
          {onBuy && (
            // Above the card's full-size link, so it buys instead of opening the product
            <Button size="sm" className="relative z-10" onClick={onBuy} disabled={buying} aria-label={`Buy ${product.title} now`}>
              {buying && <Loader2 className="animate-spin" aria-hidden />}
              Buy now
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
