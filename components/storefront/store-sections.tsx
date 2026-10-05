"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BundleBox } from "@/components/pp/bundle-box";
import { CountdownTimer } from "@/components/pp/countdown-timer";
import { OfferCard } from "@/components/pp/offer-card";
import { ReviewItem } from "@/components/pp/review-item";
import { Stars } from "@/components/pp/stars";
import { StoreProductCard, type CardProduct } from "@/components/pp/store-product-card";
import { cn } from "@/lib/utils";
import { useStorefront } from "./storefront-context";

export function SectionHead({ title, href, linkLabel = "View all", className }: { title: string; href?: string; linkLabel?: string; className?: string }) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-3", className)}>
      <h2 className="text-[28px] leading-tight md:text-3xl">{title}</h2>
      {href && (
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {linkLabel} <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function ProductGrid({ products, className }: { products: CardProduct[]; className?: string }) {
  const { slug, currency, buy, buying } = useStorefront();
  return (
    <ul className={cn("grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4", className)}>
      {products.map((p) => (
        <li key={p.id}>
          <StoreProductCard product={p} href={`/s/${slug}/${p.slug}`} currency={currency} onBuy={() => buy({ productId: p.id })} buying={buying === p.id} />
        </li>
      ))}
    </ul>
  );
}

export function OffersSection() {
  const { view, slug, currency, buy, buying } = useStorefront();
  const { coupons, bundles, deal, products } = view;
  if (!coupons.length && !bundles.length && !deal) return null;
  const dealProducts = deal ? products.filter((p) => deal.productIds.length === 0 || deal.productIds.includes(p.id)) : [];
  return (
    <section aria-label="Offers" className="mx-auto max-w-[1200px] px-4 md:px-6">
      <SectionHead title="Offers" />
      {deal && (
        <div className="mb-6 rounded-card border bg-primary p-5 text-primary-foreground md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-xs tracking-[0.08em] uppercase opacity-80">Limited-time deal</p>
              <p className="mt-1 font-display text-2xl">{deal.name}: {deal.percentOff}% off</p>
            </div>
            <CountdownTimer endsAt={deal.endsAt} onDark />
          </div>
          {dealProducts.length > 0 && (
            <ul className="mt-5 grid grid-cols-1 gap-3 text-foreground sm:grid-cols-2 lg:grid-cols-4">
              {dealProducts.slice(0, 4).map((p) => (
                <li key={p.id}><StoreProductCard product={p} href={`/s/${slug}/${p.slug}`} currency={currency} onBuy={() => buy({ productId: p.id })} buying={buying === p.id} /></li>
              ))}
            </ul>
          )}
        </div>
      )}
      {coupons.length > 0 && (
        <ul className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {coupons.slice(0, 3).map((c) => <li key={c.id}><OfferCard coupon={c} /></li>)}
        </ul>
      )}
      {bundles.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {bundles.map((b) => (
            <li key={b.bundle.id}>
              <BundleBox
                name={b.bundle.name}
                products={b.products}
                full={b.full}
                price={b.price}
                percentOff={b.percentOff}
                currency={currency}
                hrefFor={(p) => `/s/${slug}/${p.slug}`}
                onBuy={() => buy({ bundleId: b.bundle.id })}
                buying={buying === b.bundle.id}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReviewsWall() {
  const { view, slug } = useStorefront();
  if (view.topReviews.length === 0) return null;
  return (
    <section aria-labelledby="wall-h" className="mx-auto max-w-[1200px] px-4 md:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="wall-h" className="text-[28px] leading-tight md:text-3xl">What buyers say</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Stars value={view.rating.average} /> {view.rating.average.toFixed(1)} from {view.rating.count} verified reviews
          </p>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {view.topReviews.map((r) => (
          <li key={r.id} className="rounded-card border bg-surface px-5">
            <ReviewItem review={r} creatorName={view.store.ownerName.split(" ")[0]} />
            <Link href={`/s/${slug}/${r.productSlug}#reviews`} className="mb-4 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">{r.productTitle}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
