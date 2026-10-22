"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, ExternalLink, KeyRound, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ReasonDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StoreHandover } from "@/components/team/store-handover";
import { useApi } from "@/hooks/use-api";
import { getAdminStores, setStoreSuspended, type AdminStore } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatNumber } from "@/lib/format";
import { csvAmount } from "@/lib/money";

function Stores() {
  const q = useSearchParams().get("q") ?? "";
  const { data, loading, error, reload } = useApi(() => getAdminStores(), [], { live: true });
  const [suspend, setSuspend] = useState<AdminStore>();
  const [restore, setRestore] = useState<AdminStore>();
  const [handover, setHandover] = useState<AdminStore>();

  const columns = useMemo<ColumnDef<AdminStore, unknown>[]>(
    () => [
      {
        id: "store",
        accessorFn: (s) => `${s.name} ${s.slug} ${s.ownerEmail}`,
        header: "Store",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.status === "published" ? (
              <Link href={`/s/${row.original.slug}`} target="_blank" className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:underline">
                {row.original.slug} <ExternalLink className="size-3" aria-hidden />
              </Link>
            ) : (
              <span className="font-mono text-xs text-muted-foreground">{row.original.slug}</span>
            )}
          </span>
        ),
      },
      {
        id: "owner",
        accessorFn: (s) => s.ownerEmail,
        header: "Owner",
        cell: ({ row }) => (
          <Link href={`/admin/creators?q=${encodeURIComponent(row.original.ownerEmail)}`} className="flex flex-col hover:underline">
            <span>{row.original.ownerName || row.original.ownerEmail}</span>
            {row.original.ownerName && <span className="text-xs text-muted-foreground">{row.original.ownerEmail}</span>}
          </Link>
        ),
      },
      { accessorKey: "status", header: "Status", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { id: "products", accessorFn: (s) => s.products, header: "Products", enableSorting: true, cell: ({ row }) => formatNumber(row.original.products) },
      { id: "orders", accessorFn: (s) => s.orders, header: "Paid orders", enableSorting: true, cell: ({ row }) => <Link href={`/admin/orders?q=${encodeURIComponent(row.original.name)}`} className="hover:underline">{formatNumber(row.original.orders)}</Link> },
      { id: "gross", accessorFn: (s) => s.gross.amount, header: "Sales", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.gross} mono /> },
      { id: "created", accessorFn: (s) => s.createdAt, header: "Opened", enableSorting: true, cell: ({ row }) => formatDate(row.original.createdAt) },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setHandover(row.original)}><KeyRound aria-hidden /> Send to owner</Button>
            {row.original.status === "suspended" ? (
              <Button size="sm" variant="secondary" onClick={() => setRestore(row.original)}>Lift suspension</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setSuspend(row.original)}>Suspend</Button>
            )}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <DataTable
        label="Stores"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        initialSearch={q}
        searchPlaceholder="Search store, link or owner"
        toolbar={
          <Button variant="secondary" disabled={!data?.length} onClick={() => data && downloadCsv("stores", [["Store", "Link", "Owner", "Status", "Products", "Paid orders", "Sales", "Currency", "Opened"], ...data.map((s) => [s.name, s.slug, s.ownerEmail, s.status, s.products, s.orders, csvAmount(s.gross), s.gross.currency, s.createdAt.slice(0, 10)])])}>
            <Download aria-hidden /> Export CSV
          </Button>
        }
        filters={[{ columnId: "status", label: "Statuses", options: [{ value: "published", label: "Live" }, { value: "draft", label: "Draft" }, { value: "suspended", label: "Suspended" }] }]}
        empty={<EmptyState icon={StoreIcon} title="No stores yet." body="Stores show up here as soon as a creator opens one." />}
      />
      <Sheet open={!!handover} onOpenChange={(o) => !o && setHandover(undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Send {handover?.name} to its owner</SheetTitle>
            <SheetDescription>For a store PowerProof built for a brand, or from an outside shop&apos;s products. They get a claim link; when they accept, the store is theirs and the current owner ({handover?.ownerEmail}) loses access.</SheetDescription>
          </SheetHeader>
          {handover && <div className="px-4 pb-6"><StoreHandover storeId={handover.id} storeName={handover.name} mode="claim" /></div>}
        </SheetContent>
      </Sheet>
      <ReasonDialog
        open={!!suspend}
        onOpenChange={(o) => !o && setSuspend(undefined)}
        title={`Suspend ${suspend?.name ?? "this store"}?`}
        description="The store goes offline at once and buyers can't order. The seller sees that it is suspended and can't undo it. The reason is kept in the audit log."
        confirmLabel="Suspend store"
        label="Reason"
        placeholder="For example: selling counterfeit goods (report on 7 Oct)"
        onConfirm={async (reason) => {
          await setStoreSuspended(suspend!.id, true, reason);
          toast.success("Store suspended");
        }}
      />
      <ConfirmDialog
        open={!!restore}
        onOpenChange={(o) => !o && setRestore(undefined)}
        title={`Lift the suspension on ${restore?.name ?? "this store"}?`}
        description="It goes back to how it was before it was suspended. If it was live, it opens to buyers again."
        confirmLabel="Lift suspension"
        onConfirm={async () => {
          const status = await setStoreSuspended(restore!.id, false);
          toast.success(status === "published" ? "Store is live again" : "Store restored as a draft");
        }}
      />
    </>
  );
}

export default function Page() {
  return (
    <>
      <title>Stores · PowerProof admin</title>
      <PageHeader title="Stores" />
      <Suspense>
        <Stores />
      </Suspense>
    </>
  );
}
