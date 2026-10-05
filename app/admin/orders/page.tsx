"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/pp/data-table";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getPlatformOrders } from "@/lib/api";
import { countryShort, timeAgo } from "@/lib/format";
import type { Order } from "@/lib/types";

type Row = Order & { storeName: string };

export default function AdminOrdersPage() {
  const { data, loading, error, reload } = useApi(getPlatformOrders, [], { live: true });
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "number", header: "Order", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue() as string}</span> },
      { accessorKey: "storeName", header: "Store" },
      { id: "buyer", accessorFn: (o) => `${o.buyerName} ${o.buyerEmail}`, header: "Buyer", cell: ({ row }) => <span className="flex flex-col"><span>{row.original.buyerName || "—"}</span><span className="text-xs text-muted-foreground">{countryShort(row.original.countryCode)}</span></span> },
      { accessorKey: "status", header: "Status", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { id: "total", accessorFn: (o) => o.total.amount, header: "Gross", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.total} mono /> },
      { id: "fee", accessorFn: (o) => o.fees.platform.amount, header: "Our 3%", meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.fees.platform} mono className="text-accent-ink" /> },
      { id: "when", accessorFn: (o) => o.createdAt, header: "When", enableSorting: true, cell: ({ row }) => timeAgo(row.original.createdAt) },
    ],
    []
  );
  return (
    <>
      <PageHeader title="Orders" description="Every order across every store. Read-only; creators handle refunds unless there's a dispute." />
      <DataTable
        label="Platform orders"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search order, store or buyer"
        filters={[{ columnId: "status", label: "Statuses", options: ["paid", "refund_requested", "refunded", "pending", "failed"].map((v) => ({ value: v, label: v.replace("_", " ") })) }]}
        pageSize={15}
      />
    </>
  );
}
