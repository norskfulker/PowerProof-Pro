"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { useApi } from "@/hooks/use-api";
import { getAdminDisputes, type AdminDispute } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";

type Tab = "open" | "done" | "all";
const isOpen = (d: AdminDispute) => d.status === "open" || d.status === "under_review";

export default function Page() {
  const { data, loading, error, reload } = useApi(() => getAdminDisputes(), [], { live: true });
  const [tab, setTab] = useState<Tab>("open");
  const rows = useMemo(() => (tab === "all" ? data : data?.filter((d) => (tab === "open" ? isOpen(d) : !isOpen(d)))), [data, tab]);

  const columns = useMemo<ColumnDef<AdminDispute, unknown>[]>(
    () => [
      { accessorKey: "orderNumber", header: "Order", cell: ({ getValue }) => <span className="font-mono text-[0.8125rem] font-medium">{getValue() as string}</span> },
      { accessorKey: "storeName", header: "Store" },
      { id: "amount", accessorFn: (d) => d.amount.amount, header: "Amount", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.amount} mono /> },
      { accessorKey: "reason", header: "Reason", cell: ({ getValue }) => <span className="block max-w-[240px] truncate">{(getValue() as string) || "Not given"}</span> },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      {
        id: "respond",
        accessorFn: (d) => d.respondBy ?? "",
        header: "Answer by",
        enableSorting: true,
        cell: ({ row }) =>
          row.original.respondBy && isOpen(row.original) ? (
            <span className={Date.parse(row.original.respondBy) - Date.now() < 3 * 86_400_000 ? "font-semibold text-danger" : ""}>{formatDate(row.original.respondBy)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { id: "opened", accessorFn: (d) => d.createdAt, header: "Opened", enableSorting: true, cell: ({ row }) => timeAgo(row.original.createdAt) },
      {
        id: "open",
        header: () => <span className="sr-only">Respond</span>,
        meta: { align: "right" },
        cell: ({ row }) => (
          <a href={`https://dashboard.razorpay.com/app/disputes/${encodeURIComponent(row.original.gatewayId)}`} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary hover:underline">
            Open in Razorpay <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ),
      },
    ],
    []
  );

  return (
    <>
      <title>Disputed orders · PowerProof admin</title>
      <PageHeader title="Disputed orders" description="Chargebacks raised by buyers' banks. They arrive here by themselves; the evidence is submitted in the Razorpay dashboard before the answer-by date." />
      <StatusTabs
        label="Dispute status"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "open", label: "Needs an answer", count: data?.filter(isOpen).length },
          { value: "done", label: "Decided", count: data?.filter((d) => !isOpen(d)).length },
          { value: "all", label: "All", count: data?.length },
        ]}
      />
      <DataTable
        key={tab}
        label="Disputes"
        columns={columns}
        data={rows}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search order or store"
        empty={<EmptyState icon={ShieldCheck} title="No disputes." body="When a buyer's bank disputes a payment, it appears here within moments. This needs the payment webhook to be connected." />}
      />
    </>
  );
}
