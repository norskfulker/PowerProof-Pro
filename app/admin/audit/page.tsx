"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { TYPE_LABELS, getAuditLog } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

const ACTION_LABELS: Record<AuditEntry["action"], [string, "info" | "warning" | "danger"]> = {
  reveal_email: ["Revealed email", "info"],
  reveal_phone: ["Revealed phone", "info"],
  refund: ["Refunded", "warning"],
  hide_review: ["Hid review", "warning"],
  suspend_store: ["Suspended store", "danger"],
};

export default function AuditPage() {
  const { data, loading, error, reload } = useApi(getAuditLog, [], { live: true });
  const columns = useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      { id: "at", accessorFn: (e) => e.at, header: "When", enableSorting: true, cell: ({ row }) => formatDate(row.original.at, { time: true }) },
      { accessorKey: "actor", header: "Who" },
      { id: "action", accessorFn: (e) => ACTION_LABELS[e.action][0], header: "Action", cell: ({ row }) => <StatusPill status={row.original.action} label={ACTION_LABELS[row.original.action][0]} tone={ACTION_LABELS[row.original.action][1]} /> },
      { id: "target", accessorFn: (e) => `${e.targetLabel} ${e.targetId}`, header: "Record", cell: ({ row }) => <span className="flex flex-col"><span className="font-medium [overflow-wrap:anywhere]">{row.original.targetLabel}</span><span className="text-xs text-muted-foreground">{TYPE_LABELS[row.original.targetType]} · <span className="font-mono">{row.original.targetId}</span></span></span> },
      { accessorKey: "reason", header: "Reason", cell: ({ getValue }) => <span className="[overflow-wrap:anywhere]">{(getValue() as string) || <span className="text-muted-foreground">No reason given</span>}</span> },
    ],
    []
  );
  return (
    <>
      <PageHeader title="Audit log" description="Every time someone at PowerProof revealed a buyer's contact details or took an action on a creator's store." />
      <DataTable
        label="Audit log"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search who, what or why"
        pageSize={20}
        empty={<EmptyState icon={ScrollText} title="Nothing logged yet" body="Reveals and quick actions from search show up here." />}
        mobileCard={(e) => (
          <div className="rounded-card border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusPill status={e.action} label={ACTION_LABELS[e.action][0]} tone={ACTION_LABELS[e.action][1]} />
              <span className="text-xs text-muted-foreground">{formatDate(e.at, { time: true })}</span>
            </div>
            <p className="mt-2 font-medium [overflow-wrap:anywhere]">{e.targetLabel}</p>
            <p className="text-xs text-muted-foreground">{e.actor} · {TYPE_LABELS[e.targetType]}</p>
            {e.reason && <p className="mt-2 text-sm [overflow-wrap:anywhere]">“{e.reason}”</p>}
          </div>
        )}
      />
    </>
  );
}
