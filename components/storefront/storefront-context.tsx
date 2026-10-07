"use client";

import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";
import type { StorefrontView } from "@/lib/api";
import type { CurrencyCode } from "@/lib/types";

interface Ctx {
  slug: string;
  view: StorefrontView;
  currency: CurrencyCode;
  /** Buy now. Checkout isn't open yet, so this says so. */
  buy: (what: { productId: string } | { bundleId: string }) => void;
  /** id of the product/bundle whose checkout is opening */
  buying?: string;
  reload: () => void;
  preview: boolean;
}

const StorefrontContext = createContext<Ctx | null>(null);

export function StorefrontProvider({ slug, view, reload, preview, children }: { slug: string; view: StorefrontView; reload: () => void; preview: boolean; children: React.ReactNode }) {
  // Prices are shown in the store's own currency: no exchange-rate source is connected
  const currency = view.store.currency;
  const buying: string | undefined = undefined;

  const buy = useCallback(
    (_what: { productId: string } | { bundleId: string }) => {
      void _what;
      // Payments aren't connected yet: say so instead of opening a pretend checkout
      toast(preview ? "Buy now opens checkout" : "Checkout opens soon", {
        description: preview ? "Disabled in the design preview." : "This store can't take payments yet. Please check back shortly.",
      });
    },
    [preview]
  );

  return <StorefrontContext.Provider value={{ slug, view, currency, buy, buying, reload, preview }}>{children}</StorefrontContext.Provider>;
}

export function useStorefront(): Ctx {
  const c = useContext(StorefrontContext);
  if (!c) throw new Error("useStorefront must be used inside a store");
  return c;
}
