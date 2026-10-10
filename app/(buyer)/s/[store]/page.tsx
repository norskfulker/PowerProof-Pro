"use client";

import { useCallback, useMemo } from "react";
import { PageRenderer } from "@/components/page-builder/renderer";
import { useStorefront } from "@/components/storefront/storefront-context";
import { contextFromView, getBookedSlots, submitLead, subscribeNewsletter } from "@/lib/api";
import { homeDocFrom } from "@/lib/pages/templates";

/**
 * The store home: the page the creator published from the editor. Stores that haven't opened the
 * editor yet show their earlier section layout, converted the same way the editor converts it.
 */
export default function StoreHomePage() {
  const { view, slug, currency, buy, buying } = useStorefront();
  const doc = useMemo(() => view.home ?? homeDocFrom(view.design, slug, view.products.map((p) => p.id)), [view, slug]);
  const context = useMemo(() => contextFromView(view), [view]);
  // Stable, so a calendar doesn't reload its times on every render
  const loadBooked = useCallback((from: Date, to: Date) => getBookedSlots(slug, "home", from, to), [slug]);

  if (view.products.length === 0 && !view.home) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-24 text-center md:px-6">
        <h1 className="text-4xl">{view.store.name}</h1>
        <p className="mt-3 text-muted-foreground">Nothing on the shelf yet. Check back soon.</p>
      </div>
    );
  }
  return (
    <PageRenderer
      doc={doc}
      context={context}
      env={{
        mode: "live",
        currency,
        onBuy: (productId) => buy({ productId }),
        onBuyBundle: (bundleId) => buy({ bundleId }),
        buying,
        onSubscribe: (email) => subscribeNewsletter(slug, email),
        onLead: (input) => submitLead(slug, "home", input),
        loadBooked,
      }}
    />
  );
}
