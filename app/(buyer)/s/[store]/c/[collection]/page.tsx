"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductBrowser } from "@/components/storefront/product-browser";
import { useStorefront } from "@/components/storefront/storefront-context";

function Inner({ slug }: { slug: string }) {
  const { view } = useStorefront();
  const c = view.collections.find((x) => x.slug === slug);
  if (!c) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl">That collection isn&apos;t here.</h1>
        <p className="mt-2 text-muted-foreground">It may have been renamed or emptied.</p>
        <Button asChild className="mt-6"><Link href={`/s/${view.store.slug}/products`}>See all products</Link></Button>
      </div>
    );
  }
  return (
    <>
      <title>{`${c.name} · ${view.store.name}`}</title>
      <ProductBrowser collectionSlug={c.slug} title={c.name} />
    </>
  );
}

export default function CollectionPage({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = use(params);
  return (
    <Suspense>
      <Inner slug={collection} />
    </Suspense>
  );
}
