"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Webhook } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { getAdminWebhooks, retryWebhook, type AdminWebhook } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Tab = "failed" | "all";
const failed = (w: AdminWebhook) => !w.processedAt;

export default function Page() {
  const { data, loading, error, reload } = useApi(() => getAdminWebhooks(), [], { live: true });
  const [tab, setTab] = useState<Tab>("failed");
  const [busy, setBusy] = useState<number>();
  const rows = useMemo(() => (tab === "all" ? data : data?.filter(failed)), [data, tab]);

  const columns = useMemo<ColumnDef<AdminWebhook, unknown>[]>(
    () => [
      { id: "at", accessorFn: (w) => w.at, header: "Received", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.at, { time: true })}</span> },
      { accessorKey: "type", header: "Event", cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as string}</span> },
      { id: "state", accessorFn: (w) => (w.processedAt ? "done" : "failed"), header: "State", cell: ({ row }) => (row.original.processedAt ? <StatusPill status="sent" label="Handled" /> : <StatusPill status="failed" label={row.original.error ? "Failed" : "Waiting"} />) },
      { accessorKey: "error", header: "What went wrong", cell: ({ getValue }) => <span className="block max-w-[340px] truncate text-sm text-danger" title={getValue() as string}>{(getValue() as string) || "—"}</span> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.processedAt ? null : (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy === row.original.id}
              onClick={async () => {
                setBusy(row.original.id);
                try {
                  await retryWebhook(row.original.id);
                  toast.success("Handled");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Still failing");
                } finally {
                  setBusy(undefined);
                }
              }}
            >
              Retry
            </Button>
          ),
      },
    ],
    [busy]
  );

  return (
    <>
      <title>Webhooks · PowerProof admin</title>
      <PageHeader title="Webhooks" description="Messages Razorpay sent about payments, disputes and payouts. A failed one is retried by Razorpay for a while; you can run it again here. Handling is safe to repeat." />
      <StatusTabs label="Webhook state" value={tab} onChange={setTab} tabs={[{ value: "failed", label: "Not handled", count: data?.filter(failed).length }, { value: "all", label: "All recent", count: data?.length }]} />
      <DataTable
        key={tab}
        label="Webhook events"
        columns={columns}
        data={rows}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search event"
        empty={<EmptyState icon={Webhook} title={tab === "failed" ? "Everything was handled." : "No webhooks yet."} body="Events show up here once Razorpay's webhook is pointed at this site." />}
      />
    </>
  );
}
