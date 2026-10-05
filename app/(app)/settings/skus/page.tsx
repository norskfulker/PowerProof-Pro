"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Barcode, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { SaveBar } from "@/components/save/save-bar";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { SettingsSection } from "@/components/settings/settings-section";
import { useApi } from "@/hooks/use-api";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { deleteSku, getProducts, getSkus, getTaxCodes, saveSku } from "@/lib/api";
import type { Sku } from "@/lib/types";

type Draft = { id?: string; code: string; productId?: string; taxCode: string; note?: string };

export default function SkusPage() {
  const skus = useApi(getSkus, []);
  const products = useApi(() => getProducts(), []);
  const codes = useApi(getTaxCodes, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string>();
  const [original, setOriginal] = useState<Draft | null>(null);
  const unsaved = useUnsavedGuard();
  const open = (d: Draft) => { setDraft(d); setOriginal(d); setError(undefined); };
  const [toDelete, setToDelete] = useState<Sku | null>(null);

  const columns = useMemo<ColumnDef<Sku, unknown>[]>(
    () => [
      { accessorKey: "code", header: "SKU", enableSorting: true, cell: ({ getValue }) => <span className="font-mono text-[0.8125rem] font-medium">{getValue() as string}</span> },
      { accessorKey: "productTitle", header: "Product", cell: ({ getValue }) => (getValue() as string) ?? <span className="text-muted-foreground">Not linked</span> },
      { accessorKey: "taxCode", header: "Tax code", cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as string}</span> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="flex justify-end gap-2">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${row.original.code}`} onClick={() => open({ ...row.original })}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${row.original.code}`} onClick={() => setToDelete(row.original)}><Trash2 /></Button>
          </span>
        ),
      },
    ],
    []
  );

  const bar = useDirtyForm({
    value: draft,
    saved: original,
    validate: () => {
      if (draft && !/^[A-Za-z0-9-_]{2,32}$/.test(draft.code)) {
        setError("2 to 32 letters, numbers, dashes or underscores.");
        return false;
      }
      return true;
    },
    onSave: async (d) => {
      if (!d) return;
      skus.setData(await saveSku(d));
      setDraft(null);
      setOriginal(null);
    },
    onDiscard: () => setDraft(original),
    savedMessage: draft?.id ? "SKU updated" : "SKU added",
  });

  return (
    <SettingsSection title="SKUs" description="Short codes for your own tracking and your accountant. Each product gets one automatically; edit them here.">
      <DataTable
        label="SKUs"
        columns={columns}
        data={skus.data}
        loading={skus.loading && !skus.data}
        error={skus.error}
        onRetry={skus.reload}
        searchPlaceholder="Search SKUs"
        toolbar={<Button variant="secondary" onClick={() => open({ code: "", taxCode: codes.data?.find((c) => c.isDefault)?.code ?? "998433" })}><Plus aria-hidden /> Add SKU</Button>}
        empty={<EmptyState icon={Barcode} compact title="No SKUs yet." body="They appear when you add products." />}
      />
      <Sheet open={!!draft} onOpenChange={(o) => !o && (bar.dirty ? unsaved.confirmLeave(() => setDraft(null)) : setDraft(null))}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{draft?.id ? "Edit SKU" : "Add SKU"}</SheetTitle>
            <SheetDescription>Changing a SKU updates the product too.</SheetDescription>
          </SheetHeader>
          {draft && (
            <form id="sku" noValidate className="flex flex-col gap-4 px-4" onSubmit={(e) => { e.preventDefault(); bar.save(); }}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sku-code">SKU</Label>
                <Input id="sku-code" className="font-mono uppercase" value={draft.code} onChange={(e) => { setDraft({ ...draft, code: e.target.value.toUpperCase() }); setError(undefined); }} aria-invalid={!!error || undefined} aria-describedby="sku-err" />
                {error && <p id="sku-err" role="alert" className="text-sm font-medium text-danger">{error}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sku-prod">Product</Label>
                <Select value={draft.productId ?? ""} onValueChange={(v) => setDraft({ ...draft, productId: v })}>
                  <SelectTrigger id="sku-prod" className="w-full"><SelectValue placeholder="Not linked" /></SelectTrigger>
                  <SelectContent>{products.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sku-tax">Tax code</Label>
                <Select value={draft.taxCode} onValueChange={(v) => setDraft({ ...draft, taxCode: v })}>
                  <SelectTrigger id="sku-tax" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{codes.data?.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} · {c.description}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </form>
          )}
          <SheetFooter>
            {draft?.id ? (
              <SaveBar state={bar} bottomOffset="none" className="max-md:static max-md:border-0 max-md:p-0 max-md:shadow-none md:border-0 md:p-0" />
            ) : (
              <>
                {bar.error && <p role="alert" className="text-sm font-medium text-danger">{bar.error}</p>}
                <Button type="submit" form="sku" disabled={bar.saving}>Add SKU</Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.code}?`}
        description="The product stays. It just won't have this SKU on future invoices."
        confirmLabel="Delete SKU"
        onConfirm={async () => {
          if (!toDelete) return;
          skus.setData(await deleteSku(toDelete.id));
          toast.success("SKU deleted");
        }}
      />
    </SettingsSection>
  );
}
