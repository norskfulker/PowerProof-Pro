"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { readiness } from "@/components/products/readiness";
import { GuardedLink } from "@/components/plan/plan-context";
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, ExternalLink, EyeOff, FileSpreadsheet, Link2, Rocket, MoreHorizontal, Package, Pencil, Plus, Trash2 } from "lucide-react";
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
import { LinkImportDialog } from "@/components/products/link-import";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { kindLabel } from "@/components/pp/product-card";
import { ProductImageView } from "@/components/pp/product-cover";
import { InlinePrice, InlineStock, isLow, stockOf } from "@/components/products/inline-edit";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { deleteProduct, duplicateProduct, getProducts, publishProduct, unpublishProduct } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";
import { csvAmount, money } from "@/lib/money";
import type { Product } from "@/lib/types";
import { sellsKind } from "@/lib/shipping";
import { liveKindOf, SwitchLiveKindButton } from "@/components/products/switch-live-kind";

const typeOf = (p: Product) => (p.fulfilment === "physical" ? "Physical" : kindLabel(p.kind));

/** Drafts say so in words, and what's left to do: a coloured pill alone is easy to miss. */
function StatusCell({ p }: { p: Product }) {
  const todo = p.status === "draft" ? readiness(p, true).filter((i) => !i.done) : [];
  return (
    <span className="flex flex-col items-start gap-1" title={p.status === "draft" ? "Draft: not visible to buyers" : p.status === "archived" ? "Hidden from buyers" : undefined}>
      <StatusPill status={p.status} />
      {todo.length > 0 && <span className="max-w-48 text-xs text-muted-foreground">Needs {todo.map((t) => t.label.toLowerCase()).join(", ")}</span>}
      {p.publishAt && p.status === "draft" && <span className="text-xs font-medium text-primary">Goes live {formatDate(p.publishAt)}</span>}
      {p.unpublishAt && p.status === "published" && <span className="text-xs text-muted-foreground">Ends {formatDate(p.unpublishAt)}</span>}
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
type Tab = "all" | "live" | "draft" | "archived" | "low";

function ProductsPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = (["live", "draft", "archived", "low"] as const).find((s) => s === params.get("status")) ?? "all";
  const status = STATUS_PARAM[tab];
  const { data, loading, error, reload } = useApi(() => getProducts(), [], { live: true });
  const store = useCurrentStore();
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [toDeleteMany, setToDeleteMany] = useState<{ list: Product[]; clear: () => void } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  /** One at a time, so one that can't change doesn't stop the rest */
  async function bulk(list: Product[], act: (p: Product) => Promise<unknown>, done: string, clear: () => void) {
    setBulkBusy(true);
    const failed: string[] = [];
    for (const p of list) {
      try {
        await act(p);
      } catch (e) {
        failed.push(`${p.title}: ${e instanceof Error ? e.message : "couldn't change"}`);
      }
    }
    setBulkBusy(false);
    const ok = list.length - failed.length;
    if (ok) toast.success(`${ok} ${done}`);
    if (failed.length) toast.error(`${failed.length} couldn't change`, { description: failed.slice(0, 3).join(" · ") });
    clear();
    reload();
  }
  // ?link=1 opens "Add from a link" (the old Import a store address lands here)
  const [fromLink, setFromLink] = useState(params.get("link") === "1");

  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Product",
        enableSorting: true,
        cell: ({ row }) => (
          <Link href={`/catalog/products/${row.original.id}`} className="flex min-h-11 min-w-0 items-center gap-3 font-semibold hover:underline">
            <ProductImageView image={row.original.images[0]} size="xs" className="w-14 shrink-0 rounded-[8px]" />
            <span className="max-w-[280px] truncate">{row.original.title}</span>
          </Link>
        ),
      },
      { id: "type", accessorFn: typeOf, header: "Type", cell: ({ row }) => <span className="whitespace-nowrap">{typeOf(row.original)}</span> },
      { accessorKey: "kind", header: "Kind", filterFn: "equals", cell: ({ getValue }) => kindLabel(getValue() as Product["kind"]) },
      { accessorKey: "fulfilment", header: "Delivery", filterFn: "equals", cell: ({ getValue }) => (getValue() === "physical" ? "Shipped" : "Download") },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusCell p={row.original} />, filterFn: "equals" },
      { id: "stock", accessorFn: (p) => stockOf(p) ?? -1, header: "Stock", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <InlineStock product={row.original} onSaved={reload} /> },
      {
        id: "price",
        accessorFn: (p) => p.price.amount,
        header: "Price",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <InlinePrice product={row.original} onSaved={reload} />
        ),
      },
      { accessorKey: "salesCount", header: "Sales", enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as number}</span> },
      { id: "revenue", accessorFn: (p) => p.revenue.amount, header: "Revenue", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.revenue} mono /> },
      { id: "created", accessorFn: (p) => p.createdAt, header: "Added", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground" title={formatDate(row.original.createdAt)}>{timeAgo(row.original.createdAt)}</span> },
      { id: "updated", accessorFn: (p) => p.updatedAt, header: "Updated", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground" title={formatDate(row.original.updatedAt)}>{timeAgo(row.original.updatedAt)}</span> },
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
    [store.data, router, reload]
  );

  return (
    <>
      <PageHeader
        title="Your products"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="More ways to add"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setFromLink(true)}><Link2 aria-hidden /> Add from a link</DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/catalog/products/import"><FileSpreadsheet aria-hidden /> Import a CSV</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild>
              <GuardedLink kind="products" href="/catalog/products/new">
                <Plus aria-hidden /> Add product
              </GuardedLink>
            </Button>
          </>
        }
      />
      {/* Products of a kind the store has switched off: not for sale until it's switched back on */}
      {store.data && (() => {
        const other = (data ?? []).filter((p) => p.status !== "archived" && !sellsKind(store.data!.sells, p.fulfilment));
        if (!other.length) return null;
        return (
          <div role="status" className="mb-4 flex flex-col gap-2 rounded-card border border-warning/40 bg-warning-soft px-4 py-3 text-sm sm:flex-row sm:items-center">
            <p className="flex-1">
              <strong>{other.length} {other[0].fulfilment} product{other.length === 1 ? "" : "s"}</strong> can&apos;t be bought: {other[0].fulfilment} products are switched off for this store. Switch them on, or archive {other.length === 1 ? "it" : "them"}.
            </p>
            <Link href="/catalog/products/new" className="font-semibold text-primary underline underline-offset-4">Switch on</Link>
          </div>
        );
      })()}
      {/* Both kinds here: one is live; switch to the other in one click */}
      {(() => {
        const active = (data ?? []).filter((p) => p.status !== "archived");
        const live = liveKindOf(active);
        const other = live === "digital" ? "physical" : "digital";
        if (!live || !active.some((p) => p.fulfilment === other)) return null;
        return (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border bg-surface px-4 py-3 text-sm">
            <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">Live now</span>
            <p className="flex-1">Your <strong>{live}</strong> products are live. Only one kind is live at a time.</p>
            <SwitchLiveKindButton to={other} />
          </div>
        );
      })()}
      <StatusTabs
        label="Product status"
        value={tab}
        onChange={(v) => router.replace(v === "all" ? "/catalog/products" : `/catalog/products?status=${v}`, { scroll: false })}
        tabs={[
          { value: "all", label: "All", count: data?.length },
          { value: "live", label: "Live", count: data?.filter((p) => p.status === "published").length },
          { value: "draft", label: "Draft", count: data?.filter((p) => p.status === "draft").length },
          { value: "archived", label: "Archived", count: data?.filter((p) => p.status === "archived").length },
          // At or below each product's own low-stock level; only shown when there's something to restock
          ...(data?.some((p) => p.status !== "archived" && isLow(p)) || tab === "low" ? [{ value: "low" as const, label: "Low stock", count: data?.filter((p) => p.status !== "archived" && isLow(p)).length }] : []),
        ]}
      />
      <DataTable
        key={tab}
        label="Products"
        columns={columns}
        data={tab === "low" ? data?.filter((p) => p.status !== "archived" && isLow(p)) : status ? data?.filter((p) => p.status === status) : data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search by name or SKU"
        filters={[
          { columnId: "fulfilment", label: "Delivery", options: [{ value: "digital", label: "Downloads" }, { value: "physical", label: "Shipped" }] },
          { columnId: "kind", label: "Kinds", options: ["ebook", "template", "preset", "notion", "course", "audio", "other"].map((k) => ({ value: k, label: kindLabel(k as Product["kind"]) })) },
        ]}
        defaultHidden={["type", "kind", "fulfilment", "created", "updated", ...(sellsKind(store.data?.sells, "physical") ? [] : ["stock"])]}
        rowId={(p) => p.id}
        selectable
        bulkActions={(list, clear) => (
          <>
            {list.some((p) => p.status !== "published") && <Button size="sm" disabled={bulkBusy} onClick={() => bulk(list.filter((p) => p.status !== "published"), (p) => publishProduct(p.id), "made live", clear)}><Rocket aria-hidden /> Make live</Button>}
            {list.some((p) => p.status === "published") && <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => bulk(list.filter((p) => p.status === "published"), (p) => unpublishProduct(p.id), "moved to drafts", clear)}><EyeOff aria-hidden /> Move to drafts</Button>}
            <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => bulk(list, (p) => duplicateProduct(p.id), "duplicated as drafts", clear)}><Copy aria-hidden /> Duplicate</Button>
            <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => setToDeleteMany({ list, clear })}><Trash2 aria-hidden /> Delete</Button>
          </>
        )}
        summary={(rows) => {
          const cur = rows[0]?.revenue.currency ?? store.data?.currency ?? "INR";
          return [
            { label: "Live", value: rows.filter((p) => p.status === "published").length },
            { label: "Units sold", value: rows.reduce((t, p) => t + p.salesCount, 0).toLocaleString("en-IN") },
            { label: "Revenue", value: <MoneyText value={money(rows.reduce((t, p) => t + p.revenue.amount, 0), cur)} /> },
          ];
        }}
        csv={{
          filename: "products",
          columns: [
            { header: "Title", value: (p) => p.title },
            { header: "Status", value: (p) => p.status },
            { header: "Type", value: typeOf },
            { header: "SKU", value: (p) => p.sku },
            { header: "Price", value: (p) => csvAmount(p.price) },
            { header: "Compare at", value: (p) => csvAmount(p.compareAt) },
            { header: "Currency", value: (p) => p.price.currency },
            { header: "Stock", value: (p) => stockOf(p) ?? "" },
            { header: "Variants", value: (p) => p.variants?.length ?? 0 },
            { header: "Sales", value: (p) => p.salesCount },
            { header: "Revenue", value: (p) => csvAmount(p.revenue) },
            { header: "Added", value: (p) => p.createdAt },
            { header: "Store link", value: (p) => (store.data && p.status === "published" ? `${location.origin}/s/${store.data.slug}/${p.slug}` : "") },
          ],
        }}
        rowHref={(p) => `/catalog/products/${p.id}`}
        mobileCard={(p) => (
          <Link href={`/catalog/products/${p.id}`} className="flex items-center gap-3 rounded-card border bg-surface p-3">
            <ProductImageView image={p.images[0]} fallback={p.tileBackground} fallbackLabel={p.title} size="xs" className="w-20 shrink-0 rounded-[8px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{p.title}</span>
              <MoneyText value={p.price} className="mt-1 block text-sm" />
            </span>
            <StatusPill status={p.status} />
          </Link>
        )}
        empty={
          <EmptyState
            nextStep
            icon={Package}
            title="No products yet."
            body="Sell anything: a file, a course, a booking or something you ship."
            action={
              <Button asChild>
                <GuardedLink kind="products" href="/catalog/products/new"><Plus aria-hidden /> Add your first product</GuardedLink>
              </Button>
            }
          />
        }
      />
      <ConfirmDialog
        open={!!toDeleteMany}
        onOpenChange={(o) => !o && setToDeleteMany(null)}
        title={`Delete ${toDeleteMany?.list.length} products?`}
        description="They disappear from your store. Past buyers keep their downloads. This can't be undone."
        confirmLabel={`Delete ${toDeleteMany?.list.length} products`}
        onConfirm={async () => {
          if (!toDeleteMany) return;
          await bulk(toDeleteMany.list, (p) => deleteProduct(p.id), "deleted", toDeleteMany.clear);
        }}
      />
      <LinkImportDialog open={fromLink} onOpenChange={setFromLink} onDone={reload} />
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
