"use client";

import { use } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { CollectionTileArt } from "@/components/pp/collection-tile";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { ProductImageView } from "@/components/pp/product-cover";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getCollections, getProducts } from "@/lib/api";

/** Catalog › Collections › one collection and its products. */
export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const data = useApi(() => Promise.all([getCollections(), getProducts()]), [], { live: true });
  const col = data.data?.[0].find((c) => c.id === id);
  const products = col ? col.productIds.map((pid) => data.data![1].find((p) => p.id === pid)).filter((p) => !!p) : [];
  if (data.error) return <ErrorState message={data.error} onRetry={data.reload} />;
  if (!data.data) return <Skeleton className="h-96 rounded-card" />;
  if (!col) return <ErrorState title="That collection isn't here." message="It may have been deleted." />;
  return (
    <>
      <title>{`${col.name} · PowerProof`}</title>
      <PageHeader
        title={col.name}
        description={col.description || `${products.length} product${products.length === 1 ? "" : "s"}`}
        actions={
          <Button asChild variant="secondary">
            <Link href="/catalog/collections"><Pencil aria-hidden /> Edit in Collections</Link>
          </Button>
        }
      />
      <div className="mb-6 max-w-xs"><CollectionTileArt collection={col} /></div>
      {products.length === 0 ? (
        <EmptyState title="No products in this collection yet." body="Edit the collection to pick some." />
      ) : (
        <ul className="divide-y rounded-card border bg-surface" aria-label="Products in this collection">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/catalog/products/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
                <span className="w-16 shrink-0"><ProductImageView image={p.images[0]} size="xs" fallback={p.tileBackground} fallbackLabel={p.title} /></span>
                <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                <MoneyText value={p.price} className="text-sm" />
                <StatusPill status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
