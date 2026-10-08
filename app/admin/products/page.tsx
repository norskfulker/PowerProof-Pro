"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ReasonDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { getAdminProducts, setProductStatus, type AdminProduct } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatNumber } from "@/lib/format";
import { formatMoney } from "@/lib/money";

type Tab = "live" | "draft" | "archived" | "all";

function Products() {
  const q = useSearchParams().get("q") ?? "";
  const { data, loading, error, reload } = useApi(() => getAdminProducts(), [], { live: true });
  const [tab, setTab] = useState<Tab>("live");
  const [takeDown, setTakeDown] = useState<AdminProduct>();
  const [restore, setRestore] = useState<AdminProduct>();

  const rows = useMemo(() => (tab === "all" ? data : data?.filter((p) => p.status === tab)), [data, tab]);
  const count = (s: AdminProduct["status"]) => data?.filter((p) => p.status === s).length;

  const columns = useMemo<ColumnDef<AdminProduct, unknown>[]>(
    () => [
      {
        id: "product",
        accessorFn: (p) => `${p.title} ${p.storeName}`,
        header: "Product",
        cell: ({ row }) => {
          const p = row.original;
          const visible = p.status === "live" && p.storeStatus === "published";
          return (
            <span className="flex max-w-[320px] flex-col">
              {visible ? (
                <Link href={`/s/${p.storeSlug}/p/${p.slug}`} target="_blank" className="inline-flex items-center gap-1 font-medium hover:underline">
                  <span className="truncate">{p.title}</span> <ExternalLink className="size-3 shrink-0" aria-hidden />
                </Link>
              ) : (
                <span className="truncate font-medium">{p.title}</span>
              )}
              <span className="text-xs text-muted-foreground">{p.fulfilment === "physical" ? "Physical" : "Digital"}{p.type ? ` · ${p.type.replace(/_/g, " ")}` : ""}</span>
            </span>
          );
        },
      },
      { id: "store", accessorFn: (p) => p.storeName, header: "Store", cell: ({ row }) => <Link href={`/admin/stores?q=${encodeURIComponent(row.original.storeName)}`} className="hover:underline">{row.original.storeName}</Link> },
      {
        id: "status",
        accessorFn: (p) => p.status,
        header: "Status",
        cell: ({ row }) => (
          <span className="flex flex-col gap-1">
            <StatusPill status={row.original.status} />
            {row.original.status === "live" && row.original.storeStatus !== "published" && <span className="text-xs text-danger">Store is {row.original.storeStatus === "suspended" ? "suspended" : "not open"}</span>}
          </span>
        ),
      },
      { id: "price", accessorFn: (p) => p.price.amount, header: "Price", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.price} mono /> },
      { id: "units", accessorFn: (p) => p.units, header: "Sold", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => formatNumber(row.original.units) },
      { id: "revenue", accessorFn: (p) => p.revenue.amount, header: "Earned", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.revenue} mono /> },
      { id: "created", accessorFn: (p) => p.createdAt, header: "Added", enableSorting: true, cell: ({ row }) => formatDate(row.original.createdAt) },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.status === "live" ? (
            <Button size="sm" variant="secondary" className="text-danger" onClick={() => setTakeDown(row.original)}>Take off sale</Button>
          ) : row.original.status === "archived" ? (
            <Button size="sm" variant="secondary" onClick={() => setRestore(row.original)}>Put back live</Button>
          ) : null,
      },
    ],
    []
  );

  return (
    <>
      <StatusTabs
        label="Product status"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "live", label: "Live", count: count("live") },
          { value: "draft", label: "Draft", count: count("draft") },
          { value: "archived", label: "Archived", count: count("archived") },
          { value: "all", label: "All", count: data?.length },
        ]}
      />
      <DataTable
        key={tab}
        label="Products"
        columns={columns}
        data={rows}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        initialSearch={q}
        searchPlaceholder="Search product or store"
        toolbar={
          <Button
            variant="secondary"
            disabled={!rows?.length}
            onClick={() => rows && downloadCsv("products", [["Product", "Store", "Status", "Type", "Price", "Sold", "Earned", "Added"], ...rows.map((p) => [p.title, p.storeName, p.status, p.fulfilment, formatMoney(p.price), String(p.units), formatMoney(p.revenue), p.createdAt.slice(0, 10)])])}
          >
            <Download aria-hidden /> Export CSV
          </Button>
        }
        empty={<EmptyState icon={Package} title={tab === "live" ? "No live products yet." : "No products here."} body="Products show up as creators add them." />}
      />
      <ReasonDialog
        open={!!takeDown}
        onOpenChange={(o) => !o && setTakeDown(undefined)}
        title={`Take ${takeDown?.title ?? "this product"} off sale?`}
        description="It is archived and disappears from the store at once. The seller can see it is archived. The reason is written to the audit log."
        confirmLabel="Take off sale"
        placeholder="For example: listing is a copy of another seller's work"
        onConfirm={async (reason) => {
          await setProductStatus(takeDown!.id, "archived", reason);
          toast.success("Taken off sale");
        }}
      />
      <ConfirmDialog
        open={!!restore}
        onOpenChange={(o) => !o && setRestore(undefined)}
        title={`Put ${restore?.title ?? "this product"} back on sale?`}
        description="It goes live again in its store (if the store is open)."
        confirmLabel="Put live"
        onConfirm={async () => {
          await setProductStatus(restore!.id, "live");
          toast.success("Live again");
        }}
      />
    </>
  );
}

export default function Page() {
  return (
    <>
      <title>Products · PowerProof admin</title>
      <PageHeader title="Products" description="Every product in every store. Live ones are what buyers can see right now." />
      <Suspense>
        <Products />
      </Suspense>
    </>
  );
}
