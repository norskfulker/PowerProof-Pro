"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { useApi } from "@/hooks/use-api";
import { getAuditLog, type AuditEntry } from "@/lib/api";
import { formatDate } from "@/lib/format";

/** What each recorded action means, in plain words */
const ACTIONS: Record<string, string> = {
  suspend_store: "Suspended a store",
  restore_store: "Lifted a store suspension",
  hide_review: "Hid a review",
  show_review: "Showed a review again",
  hide_question: "Hid a question",
  show_question: "Showed a question again",
  report_actioned: "Took down reported content",
  report_dismissed: "Dismissed a report",
  payout_processing: "Marked a payout on its way",
  payout_paid: "Marked a payout paid",
  payout_failed: "Marked a payout failed",
  verify_deal: "Verified a marketplace deal",
  unverify_deal: "Removed a deal's verified badge",
  refund_order: "Refunded an order",
  reveal_buyer_phone: "Looked at a buyer's phone number",
};

const label = (a: string) => ACTIONS[a] ?? a.replace(/_/g, " ");

function detail(e: AuditEntry): string {
  const parts: string[] = [];
  if (typeof e.meta.reason === "string" && e.meta.reason) parts.push(e.meta.reason);
  if (typeof e.meta.ref === "string" && e.meta.ref) parts.push(`Ref ${e.meta.ref}`);
  if (typeof e.meta.from === "string" && typeof e.meta.to === "string") parts.push(`${e.meta.from} → ${e.meta.to}`);
  return parts.join(" · ");
}

export default function Page() {
  const { data, loading, error, reload } = useApi(() => getAuditLog(), [], { live: true });
  const columns = useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      { id: "when", accessorFn: (e) => e.at, header: "When", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.at, { time: true })}</span> },
      { accessorKey: "actor", header: "Who" },
      { id: "what", accessorFn: (e) => `${label(e.action)} ${e.action}`, header: "What", cell: ({ row }) => label(row.original.action) },
      { id: "on", accessorFn: (e) => `${e.targetType} ${e.targetId}`, header: "On", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.targetType}{row.original.targetId ? ` ${row.original.targetId.slice(0, 8)}` : ""}</span> },
      { id: "detail", accessorFn: (e) => detail(e), header: "Detail", cell: ({ row }) => <span className="block max-w-[320px] truncate" title={detail(row.original)}>{detail(row.original) || "—"}</span> },
    ],
    []
  );
  return (
    <>
      <title>Audit log · PowerProof admin</title>
      <PageHeader title="Audit log" description="Who revealed or changed what. Entries are added by the system whenever staff change something." />
      <DataTable
        label="Audit log"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        pageSize={20}
        searchPlaceholder="Search who, what or which item"
        empty={<EmptyState icon={ScrollText} title="Nothing recorded yet." body="Every staff action that changes something is listed here." />}
      />
    </>
  );
}
