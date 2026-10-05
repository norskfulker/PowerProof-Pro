"use client";

import { use } from "react";
import { PackageOpen } from "lucide-react";
import { BuyerShell, ConversionNote, TrustBar } from "@/components/buyer/buyer-shell";
import { BuyerStatus } from "@/components/buyer/buyer-states";
import { EmptyState } from "@/components/pp/empty-state";
import { ProductCard } from "@/components/pp/product-card";
import { useApi } from "@/hooks/use-api";
import { useBuyerCurrency } from "@/hooks/use-buyer-currency";
import { getStorefront } from "@/lib/api";

export default function StoreHomePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = use(params);
  const { data, error, reload } = useApi(() => getStorefront(slug), [slug], { live: true });
  const [currency, setCurrency] = useBuyerCurrency();

  if (!data) return <BuyerStatus error={error} onRetry={reload} kind="store" />;
  const { store, products } = data;

  return (
    <BuyerShell store={store} currency={currency} onCurrency={setCurrency}>
      <title>{store.name}</title>
      <section className="mb-8 flex flex-col gap-3 md:mb-10">
        <h1 className="text-[34px] leading-tight md:text-5xl">{store.name}</h1>
        <p className="max-w-xl text-lg text-muted-foreground">{store.tagline}</p>
      </section>
      <TrustBar refundDays={store.refundDays} className="mb-8" />
      {products.length === 0 ? (
        <EmptyState icon={PackageOpen} title="Nothing on the shelf yet." body={`${store.name} is setting up. Check back soon.`} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} href={`/s/${store.slug}/${p.slug}`} currency={currency} variant="buyer" className="h-full" />
              </li>
            ))}
          </ul>
          <ConversionNote currency={currency} className="mt-6" />
        </>
      )}
    </BuyerShell>
  );
}
