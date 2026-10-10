"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, FolderOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PALETTES } from "@/lib/palettes";
import { PageHeader } from "@/components/pp/page-header";
import { BackgroundPicker } from "@/components/media/background-picker";
import { CollectionTileArt } from "@/components/pp/collection-tile";
import { SaveBar } from "@/components/save/save-bar";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { deleteCollection, getCollections, getProducts, moveCollection, saveCollection } from "@/lib/api";
import { money } from "@/lib/money";
import type { Collection, Product } from "@/lib/types";

/** A collection with what's in it, for the table */
interface Row {
  c: Collection;
  index: number;
  items: Product[];
}

type Draft = Omit<Collection, "id" | "slug"> & { id?: string };

export default function CollectionsPage() {
  const { data, loading, error, reload, setData } = useApi(getCollections, []);
  // Every product that isn't archived, so a collection can be built before its products are live
  const products = useApi(() => getProducts().then((l) => l.filter((p) => p.status !== "archived")), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [original, setOriginal] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string>();
  const unsaved = useUnsavedGuard();
  const open = (d: Draft) => {
    setDraft(d);
    setOriginal(d);
    setFormError(undefined);
  };
  const bar = useDirtyForm({
    value: draft,
    saved: original,
    onSave: async () => {
      await save();
    },
    onDiscard: () => setDraft(original),
    savedMessage: original?.id ? "Collection updated" : "Collection added",
    autosave: false,
  });
  const [toDelete, setToDelete] = useState<Collection | null>(null);
  const store = useCurrentStore();
  const cur = store.data?.currency ?? "INR";
  const rows = useMemo<Row[] | undefined>(() => data?.map((c, index) => ({ c, index, items: (products.data ?? []).filter((p) => c.productIds.includes(p.id)) })), [data, products.data]);
  const grouped = useMemo(() => new Set(data?.flatMap((c) => c.productIds)), [data]);
  const loose = (products.data ?? []).filter((p) => !grouped.has(p.id));

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: "order", header: "#", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.index + 1}</span> },
      {
        id: "name",
        accessorFn: (r) => `${r.c.name} ${r.c.slug}`,
        header: "Collection",
        cell: ({ row }) => (
          <button type="button" onClick={() => open({ ...row.original.c })} className="flex min-h-11 min-w-0 items-center gap-3 text-left">
            <CollectionTileArt collection={row.original.c} size="xs" className="w-16 shrink-0" />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold hover:underline">{row.original.c.name}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">/c/{row.original.c.slug}</span>
            </span>
          </button>
        ),
      },
      { id: "products", accessorFn: (r) => r.c.productIds.length, header: "Products", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <span className="font-mono text-[0.8125rem]">{row.original.c.productIds.length}</span> },
      {
        id: "live",
        accessorFn: (r) => r.items.filter((p) => p.status === "published").length,
        header: "Live",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => {
          const live = row.original.items.filter((p) => p.status === "published").length;
          const drafts = row.original.items.length - live;
          return (
            <span className="flex flex-col items-end">
              <span className={`font-mono text-[0.8125rem] ${live === 0 ? "text-warning-ink" : ""}`}>{live}</span>
              {drafts > 0 && <span className="text-xs text-muted-foreground">{drafts} draft{drafts === 1 ? "" : "s"}</span>}
            </span>
          );
        },
      },
      { id: "sold", accessorFn: (r) => r.items.reduce((t, p) => t + p.salesCount, 0), header: "Sold", enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as number}</span> },
      { id: "revenue", accessorFn: (r) => r.items.reduce((t, p) => t + p.revenue.amount, 0), header: "Revenue", enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <MoneyText value={money(getValue() as number, cur)} mono /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const { c, index } = row.original;
          return (
            <div className="flex justify-end gap-0.5">
              <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={async () => setData(await moveCollection(c.id, -1))} aria-label={`Move ${c.name} up`}><ArrowUp /></Button>
              <Button variant="ghost" size="icon-sm" disabled={index === (data?.length ?? 0) - 1} onClick={async () => setData(await moveCollection(c.id, 1))} aria-label={`Move ${c.name} down`}><ArrowDown /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => open({ ...c })} aria-label={`Edit ${c.name}`}><Pencil /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`}><Trash2 /></Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, cur]
  );

  const newDraft = (): Draft => ({ name: "", productIds: [], cover: { template: "block", title: "", subtitle: "", ...PALETTES[0] } });

  async function save() {
    if (!draft) return;
    setFormError(undefined);
    setData(await saveCollection({ ...draft, cover: { ...draft.cover, title: draft.name } }));
    setDraft(null);
    setOriginal(null);
  }

  return (
    <>
      <PageHeader
        title="Collections"
        description="Group products so buyers can browse. Each one gets a tile on your store and its own page."
        actions={<Button onClick={() => open(newDraft())}><Plus aria-hidden /> New collection</Button>}
      />
      <DataTable
        label="Collections"
        columns={columns}
        data={rows}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        pageSize={100}
        searchPlaceholder="Search collections"
        noResults="No collection matches."
        summary={(list) => [
          { label: "Collections", value: list.length },
          { label: "Products grouped", value: grouped.size, hint: products.data ? `of ${products.data.length} products` : undefined },
          { label: "Not in a collection", value: products.data ? loose.length : "—", hint: loose.some((p) => p.fulfilment === "physical") ? "Physical products need one to be found" : loose.length ? "Buyers can still find them in search" : "Everything is grouped" },
          { label: "Revenue", value: <MoneyText value={money(list.reduce((t, r) => t + r.items.reduce((u, p) => u + p.revenue.amount, 0), 0), cur)} />, hint: "Products in more than one count in each" },
        ]}
        mobileCard={(r) => (
          <div className="flex items-center gap-3 rounded-card border bg-surface p-3">
            <CollectionTileArt collection={r.c} size="xs" className="w-20 shrink-0" />
            <button type="button" onClick={() => open({ ...r.c })} className="min-w-0 flex-1 text-left">
              <span className="block truncate font-semibold">{r.c.name}</span>
              <span className="block truncate text-sm text-muted-foreground">{r.c.productIds.length} products · {r.items.filter((p) => p.status === "published").length} live</span>
            </button>
            <Button variant="ghost" size="icon-sm" disabled={r.index === 0} onClick={async () => setData(await moveCollection(r.c.id, -1))} aria-label={`Move ${r.c.name} up`}><ArrowUp /></Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setToDelete(r.c)} aria-label={`Delete ${r.c.name}`}><Trash2 /></Button>
          </div>
        )}
        empty={<EmptyState icon={FolderOpen} title="No collections yet." body="Collections just help organize products. You can sell without one." action={<Button onClick={() => open(newDraft())}><Plus aria-hidden /> New collection</Button>} />}
      />

      <Sheet open={!!draft} onOpenChange={(o) => !o && (bar.dirty ? unsaved.confirmLeave(() => setDraft(null)) : setDraft(null))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{draft?.id ? "Edit collection" : "New collection"}</SheetTitle>
            <SheetDescription>A name and a colour or image for the tile. Add products now or later.</SheetDescription>
          </SheetHeader>
          {draft && (
            <form id="col" noValidate className="flex flex-col gap-4 px-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
              {formError && <p role="alert" className="text-sm font-medium text-danger">{formError}</p>}
              <div className="flex flex-col gap-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <BackgroundPicker
                label="Tile"
                aiPurpose="collection_tile"
                value={draft.background ?? { kind: "color", color: draft.cover.bg }}
                onChange={(background) => setDraft({ ...draft, background, cover: background.kind === "color" ? { ...draft.cover, bg: background.color } : draft.cover })}
                preview={() => (
                  <div className="max-w-56">
                    <CollectionTileArt collection={{ name: draft.name || "Collection", cover: draft.cover, background: draft.background ?? { kind: "color", color: draft.cover.bg } }} />
                  </div>
                )}
              />
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Products ({draft.productIds.length})</legend>
                {products.error ? (
                  <p role="alert" className="text-sm text-danger">We couldn&apos;t load your products. <button type="button" className="underline underline-offset-4" onClick={products.reload}>Try again</button></p>
                ) : !products.data ? (
                  <p className="min-h-11 text-sm text-muted-foreground">Loading products…</p>
                ) : products.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No products yet. <Link href="/catalog/products/new" className="font-medium text-primary underline underline-offset-4">Add one</Link>, then put it here.</p>
                ) : (
                <ul className="max-h-72 overflow-y-auto rounded-control border p-1">
                  {products.data.map((p) => (
                    <li key={p.id}>
                      <label className="flex min-h-11 items-center gap-3 rounded-[6px] px-2 text-sm hover:bg-muted">
                        <Checkbox checked={draft.productIds.includes(p.id)} onCheckedChange={(v) => setDraft({ ...draft, productIds: v ? [...draft.productIds, p.id] : draft.productIds.filter((x) => x !== p.id) })} />
                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                        {p.status !== "published" && <span className="shrink-0 text-xs text-muted-foreground">Draft: shows once it&apos;s live</span>}
                      </label>
                    </li>
                  ))}
                </ul>
                )}
              </fieldset>
            </form>
          )}
          <SheetFooter>
            {draft?.id ? (
              <SaveBar state={bar} bottomOffset="none" className="max-md:static max-md:border-0 max-md:p-0 max-md:shadow-none md:border-0 md:p-0" />
            ) : (
              <Button type="button" onClick={() => bar.save()} disabled={bar.saving}>
                {bar.saving && <Loader2 className="animate-spin" aria-hidden />} Add collection
              </Button>
            )}
            {bar.error && !draft?.id && <p role="alert" className="text-sm font-medium text-danger">{bar.error}</p>}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.name}”?`}
        description="The products stay in your store. Only the grouping and its page go."
        confirmLabel="Delete collection"
        onConfirm={async () => {
          if (!toDelete) return;
          setData(await deleteCollection(toDelete.id));
          toast.success("Collection deleted");
        }}
      />
    </>
  );
}
