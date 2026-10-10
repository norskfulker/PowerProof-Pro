"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { getAdminReports, resolveReport, type AdminReport } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Tab = "open" | "done";

const TAKEDOWN: Record<AdminReport["targetType"], string> = {
  review: "The review is hidden from the store.",
  question: "The question is hidden from the store.",
  product: "The product is archived and leaves the store.",
  store: "The whole store is suspended and goes offline.",
};

export default function Page() {
  const { data, loading, error, reload } = useApi(() => getAdminReports(), [], { live: true });
  const [tab, setTab] = useState<Tab>("open");
  const [takedown, setTakedown] = useState<AdminReport>();
  const rows = useMemo(() => data?.filter((r) => (tab === "open" ? r.status === "open" : r.status !== "open")), [data, tab]);

  const columns = useMemo<ColumnDef<AdminReport, unknown>[]>(
    () => [
      { id: "date", accessorFn: (r) => r.createdAt, header: "Reported", enableSorting: true, cell: ({ row }) => timeAgo(row.original.createdAt) },
      {
        id: "what",
        accessorFn: (r) => `${r.label} ${r.excerpt} ${r.storeName}`,
        header: "What was reported",
        cell: ({ row }) => (
          <span className="flex max-w-[360px] flex-col">
            <span className="text-xs font-semibold text-muted-foreground uppercase">{row.original.label}{row.original.storeName ? ` · ${row.original.storeName}` : ""}</span>
            <span className="line-clamp-3">{row.original.excerpt}</span>
          </span>
        ),
      },
      {
        id: "why",
        accessorFn: (r) => r.reason,
        header: "Why",
        cell: ({ row }) => (
          <span className="flex max-w-[240px] flex-col">
            <span>{row.original.reason}</span>
            {row.original.reporter && <span className="text-xs text-muted-foreground">{row.original.reporter}</span>}
          </span>
        ),
      },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string} label={getValue() === "open" ? "Open" : getValue() === "dismissed" ? "Dismissed" : undefined} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.status === "open" ? (
            <span className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  resolveReport(row.original.id, false).then(
                    () => toast.success("Report dismissed"),
                    (e: Error) => toast.error(e.message)
                  )
                }
              >
                Dismiss
              </Button>
              <Button size="sm" variant="secondary" className="text-danger" onClick={() => setTakedown(row.original)}>Take down</Button>
            </span>
          ) : null,
      },
    ],
    []
  );

  return (
    <>
      <title>Flags · PowerProof admin</title>
      <PageHeader title="Flags" description="Content that visitors reported from a store. Take it down or dismiss the report; either is written to the audit log." />
      <StatusTabs
        label="Report status"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "open", label: "To review", count: data?.filter((r) => r.status === "open").length },
          { value: "done", label: "Closed", count: data?.filter((r) => r.status !== "open").length },
        ]}
      />
      <DataTable
        key={tab}
        label="Reports"
        columns={columns}
        data={rows}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search reports"
        empty={<EmptyState icon={Flag} title="Nothing reported." body="When someone reports a review, question, product or store, it lands here." />}
      />
      <ConfirmDialog
        open={!!takedown}
        onOpenChange={(o) => !o && setTakedown(undefined)}
        title="Take this down?"
        description={takedown ? `${TAKEDOWN[takedown.targetType]} The report is closed as taken down.` : ""}
        confirmLabel="Take down"
        onConfirm={async () => {
          await resolveReport(takedown!.id, true);
          toast.success("Taken down");
        }}
      />
    </>
  );
}
