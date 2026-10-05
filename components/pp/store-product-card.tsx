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
  return (
    <article className={cn("group flex h-full flex-col rounded-card border bg-surface p-3 transition-[border-color] duration-150 hover:border-border-strong", className)}>
      <Link href={href} className="relative block rounded-media" tabIndex={-1} aria-hidden>
        <ProductImageView image={product.images[0]} />
        <span className="absolute top-2 left-2 flex flex-wrap gap-1">
          {info.dealEndsAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              <Timer className="size-3" /> Deal
            </span>
          )}
          {info.percentOff ? <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-danger">−{info.percentOff}%</span> : null}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 px-1 pt-3">
        <span className="eyebrow">{kindLabel(product.kind)}</span>
        <h3 className="font-sans text-base leading-snug font-semibold tracking-normal">
          <Link href={href} className="-my-3 line-clamp-2 py-3 hover:underline hover:underline-offset-4">{product.title}</Link>
        </h3>
        {rating.count > 0 ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Stars value={rating.average} />
            <span>{rating.average.toFixed(1)} ({rating.count})</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">New</span>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="flex flex-col">
            <MoneyText value={localPrice(info.price, currency)} className="font-semibold" />
            {info.compareAt && <MoneyText value={localPrice(info.compareAt, currency)} className="text-xs text-muted-foreground line-through" />}
          </span>
          {onBuy && (
            <Button size="sm" onClick={onBuy} disabled={buying} aria-label={`Buy ${product.title} now`}>
              {buying && <Loader2 className="animate-spin" aria-hidden />}
              Buy now
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
