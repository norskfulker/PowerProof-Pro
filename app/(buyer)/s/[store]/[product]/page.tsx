"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BuyerShell, ConversionNote, TrustBar } from "@/components/buyer/buyer-shell";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { HtmlPageFrame } from "@/components/buyer/html-page-frame";
import { BuyButton, ProductDetail } from "@/components/buyer/product-detail";
import { PageRenderer } from "@/components/pages/page-renderer";
import { ProductCard } from "@/components/pp/product-card";
import { useApi } from "@/hooks/use-api";
import { useBuyerCurrency } from "@/hooks/use-buyer-currency";
import { getPublicProduct, startCheckout } from "@/lib/api";
import { localPrice } from "@/lib/money";

export default function ProductPage({ params }: { params: Promise<{ store: string; product: string }> }) {
  const { store: storeSlug, product: productSlug } = use(params);
  const router = useRouter();
  const { data, error, reload } = useApi(() => getPublicProduct(storeSlug, productSlug), [storeSlug, productSlug]);
  const [currency, setCurrency] = useBuyerCurrency();
  const [pending, setPending] = useState(false);

  const buy = useCallback(
    async (productId?: string) => {
      if (!data) return;
      setPending(true);
      try {
        const order = await startCheckout(productId ?? data.product.id, currency);
        router.push(`/checkout/${order.id}`);
      } catch (e) {
        toast.error("Checkout didn't open", { description: e instanceof Error ? e.message : "Try again in a moment." });
        setPending(false);
      }
    },
    [data, currency, router]
  );

  if (!data) return <BuyerStatus error={error} onRetry={reload} />;
  const { store, product, more, page } = data;

  return (
    <BuyerShell store={store} currency={currency} onCurrency={setCurrency}>
      <title>{`${product.title} · ${store.name}`}</title>
      {page?.mode === "html" && page.html ? (
        <div className="flex flex-col gap-4">
          <h1 className="sr-only">{product.title}</h1>
          <HtmlPageFrame html={page.html} title={product.title} onBuy={(id) => buy(id)} />
          <TrustBar refundDays={store.refundDays} />
        </div>
      ) : page ? (
        <div className="flex flex-col gap-4 pb-24 md:pb-0">
          <h1 className="sr-only">{product.title}</h1>
          <div className="overflow-hidden rounded-card border">
            <PageRenderer
              blocks={page.blocks}
              storeName={store.name}
              product={{ title: product.title, price: localPrice(product.price, currency), image: product.images[0] }}
              onBuy={() => buy()}
            />
          </div>
          <TrustBar refundDays={store.refundDays} />
          <ConversionNote currency={currency} />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:hidden">
            <BuyButton onBuy={() => buy()} pending={pending} product={product} currency={currency} />
          </div>
        </div>
      ) : (
        <ProductDetail product={product} store={store} currency={currency} onBuy={() => buy()} pending={pending} />
      )}

      {more.length > 0 && (
        <section aria-labelledby="more-h" className="mt-16">
          <h2 id="more-h" className="mb-4 text-2xl">More from {store.name}</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <li key={p.id}><ProductCard product={p} href={`/s/${store.slug}/${p.slug}`} currency={currency} variant="buyer" className="h-full" /></li>
            ))}
          </ul>
        </section>
      )}
    </BuyerShell>
  );
}
