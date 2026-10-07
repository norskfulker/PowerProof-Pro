"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CollectionTile } from "@/components/pp/collection-tile";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { HeroSection } from "@/components/pp/hero-section";
import { HighlightsStrip } from "@/components/pp/highlights-strip";
import { NewsletterForm } from "@/components/pp/newsletter-form";
import { subscribeNewsletter } from "@/lib/api";
import type { ProductImage, SectionId } from "@/lib/types";
import { OffersSection, ProductGrid, ReviewsWall, SectionHead } from "./store-sections";
import { useStorefront } from "./storefront-context";

function heroHref(slug: string, target: string): string {
  if (target.startsWith("collection:")) return `/s/${slug}/c/${target.slice(11)}`;
  if (target.startsWith("product:")) return `/s/${slug}/${target.slice(8)}`;
  return `/s/${slug}/products`;
}

/** The store home page: sections in the creator's order, skipping any that are off or empty. */
export function StoreHome() {
  const { view, slug } = useStorefront();
  const { design, products, store } = view;
  const wrap = "mx-auto max-w-[1200px] px-4 md:px-6";
  const heroImages = (design.hero.imageProductIds.length
    ? design.hero.imageProductIds.map((id) => products.find((p) => p.id === id)?.images[0])
    : products.slice(0, 3).map((p) => p.images[0])
  ).filter((x): x is ProductImage => !!x);

  const render: Record<SectionId, () => React.ReactNode> = {
    announcement: () => null, // rendered above the navbar by the shell
    hero: () => (
      <HeroSection
        hero={design.hero}
        style={design.theme.heroStyle}
        href={heroHref(slug, design.hero.ctaTarget)}
        images={heroImages}
      />
    ),
    highlights: () => <HighlightsStrip refundDays={store.refundDays} rating={view.rating.average} reviewCount={view.rating.count} />,
    collections: () =>
      view.collections.length > 0 && (
        <section aria-label="Collections" className={wrap}>
          <SectionHead title="Shop by collection" href={`/s/${slug}/products`} linkLabel="All products" />
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {view.collections.map((c) => <li key={c.id}><CollectionTile collection={c} href={`/s/${slug}/c/${c.slug}`} /></li>)}
          </ul>
        </section>
      ),
    bestsellers: () =>
      products.length > 0 && (
        <section aria-label="Bestsellers" className={wrap}>
          <SectionHead title="Bestsellers" href={`/s/${slug}/products?sort=popular`} />
          <ProductGrid products={[...products].sort((a, b) => b.salesCount - a.salesCount).slice(0, 4)} />
        </section>
      ),
    new: () =>
      products.length > 4 && (
        <section aria-label="New arrivals" className={wrap}>
          <SectionHead title="New arrivals" href={`/s/${slug}/products?sort=newest`} />
          <ProductGrid products={[...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4)} />
        </section>
      ),
    offers: () => <OffersSection />,
    reviews: () => <ReviewsWall />,
    about: () => (
      <section aria-labelledby="about-h" className={wrap}>
        <div className="grid grid-cols-1 items-center gap-6 rounded-card border bg-surface p-6 md:grid-cols-[auto_1fr] md:p-10">
          <Avatar className="size-24 md:size-32"><AvatarFallback className="bg-accent-soft font-display text-3xl text-accent-ink">{design.about.initials}</AvatarFallback></Avatar>
          <div>
            <p className="eyebrow">About the creator · {design.about.location}</p>
            <h2 id="about-h" className="mt-2 text-3xl">{design.about.name}</h2>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-foreground/85">{design.about.story}</p>
            <Button asChild variant="secondary" className="mt-5"><Link href={`/s/${slug}/about`}>More about {design.about.name.split(" ")[0]}</Link></Button>
          </div>
        </div>
      </section>
    ),
    faq: () =>
      view.pages.faq.length > 0 && (
        <section aria-label="Questions" className={`${wrap} max-w-[820px]`}>
          <SectionHead title="Questions" href={`/s/${slug}/faq`} linkLabel="All questions" />
          <FaqAccordion items={view.pages.faq.slice(0, 5)} />
        </section>
      ),
    newsletter: () => (
      <div className={wrap}>
        <NewsletterForm heading={design.newsletter.heading} body={design.newsletter.body} onSubscribe={(e) => subscribeNewsletter(slug, e)} />
      </div>
    ),
  };

  if (products.length === 0) {
    return (
      <div className={`${wrap} py-24 text-center`}>
        <h1 className="text-4xl">{store.name}</h1>
        <p className="mt-3 text-muted-foreground">Nothing on the shelf yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-14 pb-4 md:gap-20">
      {design.sections.filter((s) => s.enabled).map((s) => {
        const node = render[s.id]();
        return node ? <div key={s.id} id={`section-${s.id}`}>{node}</div> : null;
      })}
    </div>
  );
}
