"use client";

import { use } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BundleBox } from "@/components/pp/bundle-box";
import { ErrorState } from "@/components/pp/empty-state";
import { ProductImageView } from "@/components/pp/product-cover";
import { StickyBuyBar } from "@/components/pp/sticky-buy-bar";
import { HtmlPageFrame } from "@/components/buyer/html-page-frame";
import { PageRenderer } from "@/components/pages/page-renderer";
import { ProductBuyBox } from "@/components/storefront/product-buy-box";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductQuestions } from "@/components/storefront/product-questions";
import { ProductReviews } from "@/components/storefront/product-reviews";
import { ProductGrid } from "@/components/storefront/store-sections";
import { useStorefront } from "@/components/storefront/storefront-context";
import { useApi } from "@/hooks/use-api";
import { getStoreProduct } from "@/lib/api";
import { formatBytes, localPrice } from "@/lib/money";

const ANCHORS = [
  ["description", "Description"],
  ["included", "What's included"],
  ["preview", "Preview"],
  ["reviews", "Reviews"],
  ["questions", "Questions"],
  ["refunds", "Refunds"],
] as const;

function fileFormat(name: string) {
  return (name.split(".").pop() ?? "file").toUpperCase();
}

export default function ProductPage({ params }: { params: Promise<{ store: string; product: string }> }) {
  const { product: productSlug } = use(params);
  const { slug, view, currency, buy, buying } = useStorefront();
  const { data, error, reload } = useApi(() => getStoreProduct(slug, productSlug), [slug, productSlug], { live: true });

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState title={error.includes("not found") ? "That product isn't here." : undefined} message={error.includes("not found") ? "It may have been renamed or taken down." : error} onRetry={reload} />
        <p className="mt-4 text-center"><Link className="font-medium underline" href={`/s/${slug}/products`}>See all products</Link></p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-4 pt-8 md:grid-cols-2 md:px-6" aria-busy="true" aria-label="Loading product">
        <Skeleton className="aspect-[4/3] rounded-card" />
        <div className="flex flex-col gap-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-14 w-full" /><Skeleton className="h-24 w-full" /></div>
      </div>
    );
  }

  const { product, reviews, questions, related, bundles, page } = data;
  const creator = view.design.about.name;
  const hasVideo = product.kind === "course" || product.kind === "preset";
  const onBuy = () => buy({ productId: product.id });

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-24 md:px-6 md:pt-10 md:pb-0">
      <title>{`${product.title} · ${view.store.name}`}</title>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href={`/s/${slug}`} className="hover:underline">Home</Link> / <Link href={`/s/${slug}/products`} className="hover:underline">Products</Link> / <span className="text-foreground">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12">
        <ProductGallery images={product.images} title={product.title} hasVideo={hasVideo} />
        <div className="flex flex-col gap-6">
          <ProductBuyBox product={product} store={view.store} creatorName={creator} currency={currency} onBuy={onBuy} buying={buying === product.id} />
          {bundles.map((b) => (
            <BundleBox key={b.bundle.id} name={b.bundle.name} products={b.products} full={b.full} price={b.price} percentOff={b.percentOff} currency={currency} hrefFor={(p) => `/s/${slug}/${p.slug}`} onBuy={() => buy({ bundleId: b.bundle.id })} buying={buying === b.bundle.id} />
          ))}
        </div>
      </div>

      <nav aria-label="On this page" className="sticky top-16 z-20 -mx-4 mt-10 overflow-x-auto border-y bg-background/95 px-4 backdrop-blur md:mx-0 md:rounded-card md:border">
        <ul className="flex gap-1">
          {ANCHORS.map(([id, label]) => (
            <li key={id}><a href={`#${id}`} className="inline-flex min-h-12 items-center px-3 text-sm font-medium whitespace-nowrap text-foreground/80 hover:text-foreground">{label}{id === "reviews" ? ` (${product.rating.count})` : id === "questions" ? ` (${questions.length})` : ""}</a></li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto mt-8 flex max-w-[860px] flex-col gap-14">
        <section id="description" aria-labelledby="h-desc" className="scroll-mt-32">
          <h2 id="h-desc" className="mb-4 text-2xl">Description</h2>
          <p className="text-lg leading-relaxed whitespace-pre-line text-foreground/90">{product.description}</p>
          {page && (
            <div className="mt-6 overflow-hidden rounded-card border">
              {page.mode === "html" && page.html ? (
                <HtmlPageFrame html={page.html} title={product.title} onBuy={(id) => buy({ productId: id })} />
              ) : (
                <PageRenderer blocks={page.blocks} storeName={view.store.name} product={{ title: product.title, price: localPrice(product.info.price, currency), image: product.images[0] }} onBuy={onBuy} />
              )}
            </div>
          )}
        </section>

        <section id="included" aria-labelledby="h-inc" className="scroll-mt-32">
          <h2 id="h-inc" className="mb-4 text-2xl">What&apos;s included</h2>
          <ul className="divide-y rounded-card border bg-surface">
            {product.files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px]">{fileFormat(f.name)}</span>
                <span className="w-16 text-right font-mono text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">Delivered instantly on screen and by email. Updates are free.</p>
        </section>

        <section id="preview" aria-labelledby="h-prev" className="scroll-mt-32">
          <h2 id="h-prev" className="mb-4 text-2xl">Preview</h2>
          {product.images.length > 1 ? (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {product.images.slice(1).map((img) => <li key={img.id}><ProductImageView image={img} size="sm" /></li>)}
            </ul>
          ) : (
            <p className="text-muted-foreground">The creator hasn&apos;t added sample pages yet.</p>
          )}
        </section>

        <section id="reviews" aria-labelledby="h-rev" className="scroll-mt-32">
          <h2 id="h-rev" className="mb-4 text-2xl">Reviews</h2>
          <ProductReviews reviews={reviews} creatorName={creator.split(" ")[0]} />
        </section>

        <section id="questions" aria-labelledby="h-q" className="scroll-mt-32">
          <h2 id="h-q" className="mb-4 text-2xl">Questions</h2>
          <ProductQuestions key={product.id} slug={slug} productId={product.id} initial={questions} />
        </section>

        <section id="refunds" aria-labelledby="h-ref" className="scroll-mt-32">
          <h2 id="h-ref" className="mb-4 text-2xl">Refund policy</h2>
          <p className="leading-relaxed text-foreground/85">{view.pages.refund}</p>
        </section>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="h-rel" className="mt-16">
          <h2 id="h-rel" className="mb-5 text-[28px]">You might also like</h2>
          <ProductGrid products={related} />
        </section>
      )}

      <StickyBuyBar watchId="main-buy" title={product.title} price={localPrice(product.info.price, currency)} onBuy={onBuy} buying={buying === product.id} />
    </div>
  );
}
