"use client";

import Link from "next/link";
import { Check, Layers, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { ProductImageView } from "@/components/pp/product-cover";
import { money } from "@/lib/money";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Most products in one bundle (the editor allows the same) */
export const BUNDLE_MAX = 5;

/**
 * Bundles start from the products: pick two or more and the bundle's settings open beside them.
 * Picking is a toggle button per product (aria-pressed), so it works the same by keyboard.
 */
export function BundleBuilder({ products, picked, onToggle, onOpen, onClear, open }: { products: Product[]; picked: string[]; onToggle: (id: string) => void; onOpen: () => void; onClear: () => void; open: boolean }) {
  if (products.length === 0) {
    return (
      <EmptyState
        compact
        icon={Layers}
        title="No products to bundle yet."
        body="Add two or more products, then pick them here to sell them together."
        action={
          <Button asChild>
            <Link href="/catalog/products/new"><Plus aria-hidden /> Add product</Link>
          </Button>
        }
      />
    );
  }
  const full = products.filter((p) => picked.includes(p.id)).reduce((t, p) => t + p.price.amount, 0);
  const currency = products[0].price.currency;
  return (
    <section aria-labelledby="bundle-pick" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="bundle-pick" className="font-display text-xl">Pick products to bundle</h2>
        <p className="text-sm text-muted-foreground">
          {products.length < 2 ? "Add one more product to make a bundle." : picked.length < 2 ? `Pick ${picked.length === 0 ? "two" : "one more"}. The bundle opens as soon as you have two.` : `${picked.length} picked, up to ${BUNDLE_MAX}.`}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {products.map((p) => {
          const on = picked.includes(p.id);
          const atMax = !on && picked.length >= BUNDLE_MAX;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={atMax}
                onClick={() => onToggle(p.id)}
                className={cn(
                  "relative flex h-full w-full flex-col gap-2 rounded-card border bg-surface p-2 text-left transition-[border-color,box-shadow] hover:border-border-strong disabled:opacity-50",
                  on && "border-primary ring-2 ring-primary/30 hover:border-primary"
                )}
              >
                <span className={cn("absolute top-3 right-3 z-10 grid size-6 place-items-center rounded-full border-2 bg-surface", on ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")} aria-hidden>
                  {on && <Check className="size-3.5" />}
                </span>
                <ProductImageView image={p.images[0]} fallback={p.tileBackground} fallbackLabel={p.title} size="sm" />
                <span className="line-clamp-2 px-1 text-sm font-medium">{p.title}</span>
                <span className="mt-auto flex items-center justify-between gap-2 px-1 pb-1">
                  <MoneyText value={p.price} className="text-sm" />
                  {p.status !== "published" && <span className="text-xs text-muted-foreground">Draft</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {picked.length > 0 && !open && (
        // Closed the settings with products still picked: one tap brings them back
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-3 rounded-card border bg-surface p-3 shadow-pop md:bottom-4">
          <p className="flex-1 text-sm">
            <strong>{picked.length} picked</strong> · <MoneyText value={money(full, currency)} /> together
          </p>
          <Button variant="ghost" size="sm" onClick={onClear}><X aria-hidden /> Clear</Button>
          <Button size="sm" onClick={onOpen} disabled={picked.length < 2}><Layers aria-hidden /> Bundle these</Button>
        </div>
      )}
    </section>
  );
}
