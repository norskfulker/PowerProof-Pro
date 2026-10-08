"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { canConvert, setActiveRates } from "@/lib/fx";
import { toast } from "sonner";
import { CheckoutSheet } from "@/components/buyer/checkout-sheet";
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
  /** Buy now. Checkout isn't open yet, so this says so. */
  buy: (what: { productId: string } | { bundleId: string }) => void;
  /** id of the product/bundle whose checkout is opening */
  buying?: string;
  reload: () => void;
  preview: boolean;
}

const StorefrontContext = createContext<Ctx | null>(null);

export function StorefrontProvider({ slug, view, reload, preview, children }: { slug: string; view: StorefrontView; reload: () => void; preview: boolean; children: React.ReactNode }) {
  // Prices start in the store's own currency; buyers can view them in another when rates are loaded
  const [picked, setCurrency] = useState<CurrencyCode>();
  const rates = view.rates ?? {};
  const convertible = canConvert(rates, view.store.currency);
  const currency = convertible && picked && rates[picked] ? picked : view.store.currency;
  setActiveRates(rates);
  const buying: string | undefined = undefined;

  const [cart, setCart] = useState<string[]>();
  const buy = useCallback(
    (what: { productId: string } | { bundleId: string }) => {
      // The design preview never takes money
      if (preview) return void toast("Buy now opens checkout", { description: "Disabled in the design preview." });
      const ids = "productId" in what ? [what.productId] : view.bundles.find((b) => b.bundle.id === what.bundleId)?.bundle.productIds ?? [];
      if (ids.length) setCart(ids);
    },
    [preview, view.bundles]
  );
  const items = (cart ?? []).map((id) => view.products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <StorefrontContext.Provider value={{ slug, view, currency, setCurrency, convertible, buy, buying, reload, preview }}>
      {children}
      <CheckoutSheet open={!!cart && items.length > 0} onOpenChange={(o) => !o && setCart(undefined)} storeId={view.store.id} storeSlug={slug} products={items} />
    </StorefrontContext.Provider>
  );
}

export function useStorefront(): Ctx {
  const c = useContext(StorefrontContext);
  if (!c) throw new Error("useStorefront must be used inside a store");
  return c;
}
