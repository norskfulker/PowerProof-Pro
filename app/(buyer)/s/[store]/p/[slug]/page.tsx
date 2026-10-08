"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { PageRenderer } from "@/components/page-builder/renderer";
import { useStorefront } from "@/components/storefront/storefront-context";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getBookedSlots, getPublicVisualPage, submitLead, subscribeNewsletter } from "@/lib/api";

/** A published visual page, rendered by the same renderer the editor uses. */
export default function StoreVisualPage({ params }: { params: Promise<{ store: string; slug: string }> }) {
  const { store, slug } = use(params);
  const { currency, buy, buying } = useStorefront();
  // Stable, so a calendar doesn't reload its times on every render
  const loadBooked = useCallback((from: Date, to: Date) => getBookedSlots(store, slug, from, to), [store, slug]);
  const { data, error } = useApi(() => getPublicVisualPage(store, slug), [store, slug], { live: true });

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-24 text-center">
        <title>Page not found</title>
        <h1 className="text-3xl">That page isn&apos;t here</h1>
        <p className="text-muted-foreground">It may have been unpublished or renamed.</p>
        <Link href={`/s/${store}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">
          Go to the store
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-4 px-4 py-10" aria-busy>
        <Skeleton className="mx-auto h-72 w-full max-w-5xl rounded-card" />
        <Skeleton className="mx-auto h-40 w-full max-w-4xl rounded-card" />
      </div>
    );
  }
  return (
    <>
      <title>{data.seo.title || data.title}</title>
      <meta name="description" content={data.seo.description} />
      {/* Focus mode (squeeze pages): the store's menu and footer step aside so there is one thing to do */}
      {data.doc.focus && <style>{`[data-store-chrome]{display:none!important}`}</style>}
      <PageRenderer
        doc={data.doc}
        context={data.context}
        env={{ mode: "live", currency, onBuy: (productId) => buy({ productId }), buying, onSubscribe: (email) => subscribeNewsletter(store, email), onLead: (input) => submitLead(store, slug, input), loadBooked }}
      />
    </>
  );
}
