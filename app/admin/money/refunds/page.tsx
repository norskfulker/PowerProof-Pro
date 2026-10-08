"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Undo2 } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getAdminRefunds, type AdminRefund } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function Page() {
  const { data, loading, error, reload } = useApi(() => getAdminRefunds(), [], { live: true });
  const columns = useMemo<ColumnDef<AdminRefund, unknown>[]>(
    () => [
      { id: "date", accessorFn: (r) => r.createdAt, header: "Date", enableSorting: true, cell: ({ row }) => formatDate(row.original.createdAt, { time: true }) },
      { accessorKey: "orderNumber", header: "Order", cell: ({ row }) => <Link href={`/admin/orders?q=${encodeURIComponent(row.original.orderNumber)}`} className="font-mono text-[0.8125rem] font-medium hover:underline">{row.original.orderNumber}</Link> },
      { accessorKey: "storeName", header: "Store" },
      { accessorKey: "reason", header: "Reason", cell: ({ getValue }) => <span className="block max-w-[280px] truncate">{(getValue() as string) || "Not given"}</span> },
      { id: "amount", accessorFn: (r) => r.amount.amount, header: "Refunded", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.amount} mono className="font-medium" /> },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string} label={getValue() === "processed" ? "Refunded" : undefined} tone={getValue() === "processed" ? "success" : undefined} /> },
    ],
    []
  );
  return (
    <>
      <title>Refunds · PowerProof admin</title>
      <PageHeader title="Refunds" description="Every refund across stores. To refund an order, find it under Orders." />
      <DataTable
        label="Refunds"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search order, store or reason"
        empty={<EmptyState icon={Undo2} title="No refunds." body="Refunds from sellers and from PowerProof both appear here." />}
      />
    </>
  );
}
