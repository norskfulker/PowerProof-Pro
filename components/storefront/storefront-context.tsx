"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBuyerCurrency } from "@/hooks/use-buyer-currency";
import { startCheckout, type StorefrontView } from "@/lib/api";
import type { CurrencyCode } from "@/lib/types";

interface Ctx {
  slug: string;
  view: StorefrontView;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  /** Starts checkout for a product or a bundle and navigates there. */
  buy: (what: { productId: string } | { bundleId: string }) => void;
  /** id of the product/bundle whose checkout is opening */
  buying?: string;
  reload: () => void;
  preview: boolean;
}

const StorefrontContext = createContext<Ctx | null>(null);

export function StorefrontProvider({ slug, view, reload, preview, children }: { slug: string; view: StorefrontView; reload: () => void; preview: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [currency, setCurrency] = useBuyerCurrency();
  const [buying, setBuying] = useState<string>();

  const buy = useCallback(
    async (what: { productId: string } | { bundleId: string }) => {
      if (preview) {
        toast("Buy now opens checkout", { description: "Disabled in the design preview." });
        return;
      }
      const id = "productId" in what ? what.productId : what.bundleId;
      setBuying(id);
      try {
        const order = await startCheckout(slug, what, currency);
        router.push(`/checkout/${order.id}`);
      } catch (e) {
        toast.error("Checkout didn't open", { description: e instanceof Error ? e.message : "Try again in a moment." });
        setBuying(undefined);
      }
    },
    [slug, currency, router, preview]
  );

  return <StorefrontContext.Provider value={{ slug, view, currency, setCurrency, buy, buying, reload, preview }}>{children}</StorefrontContext.Provider>;
}

export function useStorefront(): Ctx {
  const c = useContext(StorefrontContext);
  if (!c) throw new Error("useStorefront must be used inside a store");
  return c;
}
