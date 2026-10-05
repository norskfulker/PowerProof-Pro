"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GuardedLink } from "@/components/plan/plan-context";
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, ExternalLink, MoreHorizontal, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { kindLabel } from "@/components/pp/product-card";
import { ProductImageView } from "@/components/pp/product-cover";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { deleteProduct, duplicateProduct, getProducts, getStore } from "@/lib/api";
import type { Product } from "@/lib/types";

export default function ProductsPage() {
  const { data, loading, error, reload } = useApi(() => getProducts(), [], { live: true });
  const store = useApi(getStore, []);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Product",
        enableSorting: true,
        cell: ({ row }) => (
          <Link href={`/products/${row.original.id}`} className="flex min-h-11 min-w-0 items-center gap-3 font-semibold hover:underline">
            <ProductImageView image={row.original.images[0]} size="xs" className="w-14 shrink-0 rounded-[8px]" />
            <span className="flex min-w-0 flex-col">
              <span className="max-w-[280px] truncate">{row.original.title}</span>
              <span className="font-mono text-[0.6875rem] font-normal text-muted-foreground">{row.original.sku}</span>
            </span>
          </Link>
        ),
      },
      { accessorKey: "kind", header: "Type", cell: ({ getValue }) => kindLabel(getValue() as Product["kind"]), filterFn: "equals" },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string} />, filterFn: "equals" },
      { id: "price", accessorFn: (p) => p.price.amount, header: "Price", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.price} mono /> },
      { accessorKey: "salesCount", header: "Sales", enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as number}</span> },
      { id: "revenue", accessorFn: (p) => p.revenue.amount, header: "Revenue", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.revenue} mono /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/products/${row.original.id}`}><Pencil aria-hidden /> Edit</Link>
              </DropdownMenuItem>
              {row.original.status === "published" && store.data && (
                <DropdownMenuItem asChild>
                  <Link href={`/s/${store.data.slug}/${row.original.slug}`} target="_blank"><ExternalLink aria-hidden /> View on store</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={async () => {
                  const p = await duplicateProduct(row.original.id);
                  toast.success("Duplicated as a draft", { description: p.title });
                }}
              >
                <Copy aria-hidden /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(row.original)}>
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [store.data]
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell. Drafts stay hidden until you publish."
        actions={
          <Button asChild>
            <GuardedLink kind="products" href="/products/new">
              <Plus aria-hidden /> Add product
            </GuardedLink>
          </Button>
        }
      />
      <DataTable
        label="Products"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search by name or SKU"
        filters={[
          { columnId: "status", label: "Statuses", options: [{ value: "published", label: "Live" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }] },
          { columnId: "kind", label: "Types", options: ["ebook", "template", "preset", "notion", "course", "audio", "other"].map((k) => ({ value: k, label: kindLabel(k as Product["kind"]) })) },
        ]}
        rowHref={(p) => `/products/${p.id}`}
        mobileCard={(p) => (
          <Link href={`/products/${p.id}`} className="flex items-center gap-3 rounded-card border bg-surface p-3">
            <ProductImageView image={p.images[0]} fallback={p.tileBackground} fallbackLabel={p.title} size="xs" className="w-20 shrink-0 rounded-[8px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{p.title}</span>
              <span className="mt-1 flex items-center gap-2">
                <MoneyText value={p.price} className="text-sm" />
                <span className="font-mono text-xs text-muted-foreground">{p.salesCount} sold</span>
              </span>
            </span>
            <StatusPill status={p.status} />
          </Link>
        )}
        empty={
          <EmptyState
            nextStep
            icon={Package}
            title="No products yet."
            body="Paste a link, upload a file or build a page. Your first one takes about a minute."
            action={
              <Button asChild>
                <GuardedLink kind="products" href="/products/new"><Plus aria-hidden /> Add your first product</GuardedLink>
              </Button>
            }
          />
        }
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.title}”?`}
        description="It disappears from your store. Past buyers keep their downloads. This can't be undone."
        confirmLabel="Delete product"
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteProduct(toDelete.id);
          toast.success("Product deleted");
        }}
      />
    </>
  );
}
