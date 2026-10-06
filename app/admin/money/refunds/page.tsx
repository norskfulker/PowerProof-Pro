"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/pp/data-table";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getAdminRefunds, type AdminRefundRow } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function AdminRefundsPage() {
  const { data, loading, error, reload } = useApi(getAdminRefunds, []);
  const columns = useMemo<ColumnDef<AdminRefundRow, unknown>[]>(
    () => [
      { accessorKey: "number", header: "Order", cell: ({ getValue }) => <span className="font-mono text-[0.8125rem] font-medium">{getValue() as string}</span> },
      { accessorKey: "storeName", header: "Store" },
      { accessorKey: "buyerEmail", header: "Buyer", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
      { id: "amount", accessorFn: (r) => r.amount.amount, header: "Amount", meta: { align: "right" }, enableSorting: true, cell: ({ row }) => <MoneyText value={row.original.amount} mono /> },
      { accessorKey: "status", header: "Status", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { id: "reason", header: "Reason", cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.reason ?? "—"}</span> },
      { id: "at", accessorFn: (r) => r.at, header: "When", enableSorting: true, cell: ({ row }) => formatDate(row.original.at) },
    ],
    []
  );
  return (
    <>
      <PageHeader title="Refunds" description="Refunds asked for and refunds sent, across every store. Buyer emails stay masked." />
      <DataTable
        label="Refunds"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search by order or store"
        filters={[{ columnId: "status", label: "Statuses", options: [{ value: "refund_requested", label: "Refund asked" }, { value: "refunded", label: "Refunded" }] }]}
        mobileCard={(r) => (
          <div className="flex items-center gap-3 rounded-card border bg-surface p-4">
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-sm font-semibold">{r.number}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {r.storeName} · {formatDate(r.at)}
              </span>
            </span>
            <MoneyText value={r.amount} />
            <StatusPill status={r.status} />
          </div>
        )}
      />
    </>
  );
}
