"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { canConvert, setActiveRates } from "@/lib/fx";
import { CheckoutSheet, leftOf, type CartLine } from "@/components/buyer/checkout-sheet";
import type { StorefrontView } from "@/lib/api";
import type { CurrencyCode } from "@/lib/types";

interface Ctx {
  slug: string;
  view: StorefrontView;
  /** The currency prices are shown in (the buyer's pick; the store's own to start) */
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  /** Whether there are rates to offer other currencies */
  convertible: boolean;
  /** Buy now: opens checkout with the product (its option and how many, for physical ones) or a bundle */
  buy: (what: { productId: string; variantId?: string; quantity?: number } | { bundleId: string }) => void;
  /** id of the product/bundle whose checkout is opening */
  buying?: string;
  reload: () => void;
}

const StorefrontContext = createContext<Ctx | null>(null);

export function StorefrontProvider({ slug, view, reload, children }: { slug: string; view: StorefrontView; reload: () => void; children: React.ReactNode }) {
  // Prices start in the store's own currency; buyers can view them in another when rates are loaded
  const [picked, setCurrency] = useState<CurrencyCode>();
  const rates = view.rates ?? {};
  const convertible = canConvert(rates, view.store.currency);
  const currency = convertible && picked && rates[picked] ? picked : view.store.currency;
  setActiveRates(rates);
  const buying: string | undefined = undefined;

  const [cart, setCart] = useState<CartLine[]>();
  const buy = useCallback(
    (what: { productId: string; variantId?: string; quantity?: number } | { bundleId: string }) => {
      const wanted = "productId" in what ? [what] : (view.bundles.find((b) => b.bundle.id === what.bundleId)?.bundle.productIds ?? []).map((productId) => ({ productId, variantId: undefined, quantity: 1 }));
      const lines = wanted.flatMap((w): CartLine[] => {
        const product = view.products.find((p) => p.id === w.productId);
        if (!product) return [];
        // With one option left in stock (or only one option), it's picked for them
        const open = product.variants?.filter((v) => (leftOf(product, v.id) ?? 1) > 0) ?? [];
        const variantId = w.variantId ?? (product.variants?.length === 1 || open.length === 1 ? (open[0] ?? product.variants![0]).id : undefined);
        return [{ product, variantId, quantity: Math.max(1, w.quantity ?? 1) }];
      });
      if (lines.length) setCart(lines);
    },
    [view.bundles, view.products]
  );
  const items = cart ?? [];

  return (
    <StorefrontContext.Provider value={{ slug, view, currency, setCurrency, convertible, buy, buying, reload }}>
      {children}
      <CheckoutSheet open={!!cart && items.length > 0} onOpenChange={(o) => !o && setCart(undefined)} storeId={view.store.id} storeSlug={slug} lines={items} onLines={setCart} shipping={view.store.shipping} sellerName={view.store.invoiceName} />
    </StorefrontContext.Provider>
  );
}

export function useStorefront(): Ctx {
  const c = useContext(StorefrontContext);
  if (!c) throw new Error("useStorefront must be used inside a store");
  return c;
}
