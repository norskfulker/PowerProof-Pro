"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getDisputes, setDisputeStatus } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Dispute } from "@/lib/types";

const REASON: Record<Dispute["reason"], string> = {
  not_received: "Says it never arrived",
  not_as_described: "Not as described",
  fraud: "Card holder says it wasn't them",
  duplicate: "Charged twice",
};

export default function AdminDisputesPage() {
  const { data, loading, error, reload, setData } = useApi(getDisputes, []);

  const columns = useMemo<ColumnDef<Dispute, unknown>[]>(
    () => [
      { accessorKey: "orderNumber", header: "Order", cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as string}</span> },
      { accessorKey: "storeName", header: "Store" },
      { accessorKey: "reason", header: "Reason", cell: ({ getValue }) => REASON[getValue() as Dispute["reason"]] },
      { id: "amount", accessorFn: (d) => d.amount.amount, header: "Amount", meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.amount} mono /> },
      { accessorKey: "status", header: "Status", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { id: "due", accessorFn: (d) => d.dueBy, header: "Respond by", enableSorting: true, cell: ({ row }) => {
        const days = Math.ceil((Date.parse(row.original.dueBy) - Date.now()) / 86400000);
        const open = row.original.status === "open" || row.original.status === "under_review";
        return <span className={open && days <= 2 ? "font-semibold text-danger" : undefined}>{formatDate(row.original.dueBy)}{open && days >= 0 ? ` · ${days}d` : ""}</span>;
      } },
      { id: "actions", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.orderNumber}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["under_review", "won", "lost"] as const).map((s) => (
              <DropdownMenuItem key={s} disabled={row.original.status === s} onSelect={async () => {
                const d = await setDisputeStatus(row.original.id, s);
                setData((data ?? []).map((x) => (x.id === d.id ? d : x)));
                toast.success(`Marked ${s.replace("_", " ")}`, { description: row.original.orderNumber });
              }}>
                Mark {s.replace("_", " ")}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) },
    ],
    [data, setData]
  );

  return (
    <>
      <PageHeader title="Disputes" description="Chargebacks raised with the card network. Upload evidence before the deadline or the gateway rules against us." />
      <DataTable
        label="Disputes"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search order or store"
        filters={[{ columnId: "status", label: "Statuses", options: ["open", "under_review", "won", "lost"].map((v) => ({ value: v, label: v.replace("_", " ") })) }]}
        empty={<EmptyState icon={ShieldAlert} title="No disputes." body="Nobody's fighting a charge. Enjoy it." />}
      />
    </>
  );
}
