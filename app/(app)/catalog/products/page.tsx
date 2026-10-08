"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { readiness } from "@/components/products/readiness";
import { GuardedLink } from "@/components/plan/plan-context";
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, ExternalLink, EyeOff, FileSpreadsheet, Rocket, MoreHorizontal, Package, Pencil, Plus, Trash2 } from "lucide-react";
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
import { StatusTabs } from "@/components/pp/status-tabs";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { deleteProduct, duplicateProduct, getProducts, publishProduct, unpublishProduct } from "@/lib/api";
import type { Product } from "@/lib/types";

/** Drafts say so in words, and what's left to do: a coloured pill alone is easy to miss. */
function StatusCell({ p }: { p: Product }) {
  const todo = p.status === "draft" ? readiness(p, true).filter((i) => !i.done) : [];
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusPill status={p.status} />
      {p.status === "draft" && (
        <span className="max-w-48 text-xs text-muted-foreground">
          Not visible to buyers.{todo.length > 0 && <> Needs {todo.map((t) => t.label.toLowerCase()).join(", ")}.</>}
        </span>
      )}
      {p.status === "archived" && <span className="text-xs text-muted-foreground">Hidden from buyers.</span>}
    </span>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsPageInner />
    </Suspense>
  );
}

// ?status=live|draft|archived is the selected tab (kept in the address so it can be shared and reloaded)
const STATUS_PARAM: Record<string, Product["status"]> = { live: "published", draft: "draft", archived: "archived" };
type Tab = "all" | "live" | "draft" | "archived";

function ProductsPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = (["live", "draft", "archived"] as const).find((s) => s === params.get("status")) ?? "all";
  const status = STATUS_PARAM[tab];
  const { data, loading, error, reload } = useApi(() => getProducts(), [], { live: true });
  const store = useCurrentStore();
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Product",
        enableSorting: true,
        cell: ({ row }) => (
          <Link href={`/catalog/products/${row.original.id}`} className="flex min-h-11 min-w-0 items-center gap-3 font-semibold hover:underline">
            <ProductImageView image={row.original.images[0]} size="xs" className="w-14 shrink-0 rounded-[8px]" />
            <span className="flex min-w-0 flex-col">
              <span className="max-w-[280px] truncate">{row.original.title}</span>
              <span className="font-mono text-[0.6875rem] font-normal text-muted-foreground">{row.original.sku}</span>
            </span>
          </Link>
        ),
      },
      { accessorKey: "kind", header: "Type", cell: ({ getValue }) => kindLabel(getValue() as Product["kind"]), filterFn: "equals" },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusCell p={row.original} />, filterFn: "equals" },
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
                <Link href={`/catalog/products/${row.original.id}`}><Pencil aria-hidden /> Edit</Link>
              </DropdownMenuItem>
              {row.original.status === "published" && store.data && (
                <DropdownMenuItem asChild>
                  <Link href={`/s/${store.data.slug}/${row.original.slug}`} target="_blank"><ExternalLink aria-hidden /> View on store</Link>
                </DropdownMenuItem>
              )}
              {row.original.status !== "published" ? (
                <DropdownMenuItem
                  onSelect={async () => {
                    try {
                      await publishProduct(row.original.id);
                      toast.success("It's live", { description: row.original.title });
                    } catch (e) {
                      toast.error("It can't go live yet", { description: e instanceof Error ? e.message : undefined, action: { label: "Fix it", onClick: () => router.push(`/catalog/products/${row.original.id}`) } });
                    }
                  }}
                >
                  <Rocket aria-hidden /> Make it live
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={async () => {
                    await unpublishProduct(row.original.id);
                    toast.success("Moved to drafts", { description: "Buyers can't see it now." });
                  }}
                >
                  <EyeOff aria-hidden /> Move to drafts
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
    [store.data, router]
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell. Drafts stay hidden until you publish."
        actions={
          <>
            <Button asChild variant="secondary"><Link href="/catalog/products/import"><FileSpreadsheet aria-hidden /> Import</Link></Button>
            <Button asChild>
              <GuardedLink kind="products" href="/catalog/products/new">
                <Plus aria-hidden /> Add product
              </GuardedLink>
            </Button>
          </>
        }
      />
      <StatusTabs
        label="Product status"
        value={tab}
        onChange={(v) => router.replace(v === "all" ? "/catalog/products" : `/catalog/products?status=${v}`, { scroll: false })}
        tabs={[
          { value: "all", label: "All", count: data?.length },
          { value: "live", label: "Live", count: data?.filter((p) => p.status === "published").length },
          { value: "draft", label: "Draft", count: data?.filter((p) => p.status === "draft").length },
          { value: "archived", label: "Archived", count: data?.filter((p) => p.status === "archived").length },
        ]}
      />
      <DataTable
        key={tab}
        label="Products"
        columns={columns}
        data={status ? data?.filter((p) => p.status === status) : data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search by name or SKU"
        filters={[
          { columnId: "kind", label: "Types", options: ["ebook", "template", "preset", "notion", "course", "audio", "other"].map((k) => ({ value: k, label: kindLabel(k as Product["kind"]) })) },
        ]}
        rowHref={(p) => `/catalog/products/${p.id}`}
        mobileCard={(p) => (
          <Link href={`/catalog/products/${p.id}`} className="flex items-center gap-3 rounded-card border bg-surface p-3">
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
            body="Upload the file buyers get, name it and set a price. Your first one takes about a minute."
            action={
              <Button asChild>
                <GuardedLink kind="products" href="/catalog/products/new"><Plus aria-hidden /> Add your first product</GuardedLink>
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
