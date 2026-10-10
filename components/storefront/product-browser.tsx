"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductSort } from "@/lib/types";
import { ProductGrid } from "./store-sections";
import { useStorefront } from "./storefront-context";

const SORTS: { id: ProductSort; label: string }[] = [
  { id: "popular", label: "Most popular" },
  { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
];

/** Grid with search, collection filter and sort. Pass `collectionSlug` to lock the collection. */
export function ProductBrowser({ collectionSlug, title, description }: { collectionSlug?: string; title: string; description?: string }) {
  const { view } = useStorefront();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [col, setCol] = useState(collectionSlug ?? "all");
  const [sort, setSort] = useState<ProductSort>((params.get("sort") as ProductSort) || "popular");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const collection = view.collections.find((c) => c.slug === col);
    const filtered = view.products.filter(
      (p) => (!collection || collection.productIds.includes(p.id)) && (!s || p.title.toLowerCase().includes(s) || p.description.toLowerCase().includes(s))
    );
    const sorted = [...filtered];
    if (sort === "popular") sorted.sort((a, b) => b.salesCount - a.salesCount);
    if (sort === "newest") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "price-asc") sorted.sort((a, b) => a.info.price.amount - b.info.price.amount);
    if (sort === "price-desc") sorted.sort((a, b) => b.info.price.amount - a.info.price.amount);
    if (sort === "rating") sorted.sort((a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count);
    return sorted;
  }, [view, q, col, sort]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 md:px-6 md:pt-12">
      <h1 className="text-[2.25rem] leading-tight md:text-5xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{description}</p>}
      <div className="mt-6 mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search products" className="pl-10" />
        </div>
        {!collectionSlug && (
          <Select value={col} onValueChange={setCol}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Collection"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All collections</SelectItem>
              {view.collections.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={sort} onValueChange={(v) => setSort(v as ProductSort)}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Sort by"><SelectValue /></SelectTrigger>
          <SelectContent>{SORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <p className="font-mono text-xs text-muted-foreground sm:ml-auto" aria-live="polite">{list.length} product{list.length === 1 ? "" : "s"}</p>
      </div>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
          <SearchX className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-display text-lg">Nothing matches that.</p>
          <p className="text-sm text-muted-foreground">Try a shorter search or another collection.</p>
          <Button variant="secondary" onClick={() => { setQ(""); if (!collectionSlug) setCol("all"); }}>Clear search</Button>
        </div>
      ) : (
        <ProductGrid products={list} />
      )}
    </div>
  );
}
