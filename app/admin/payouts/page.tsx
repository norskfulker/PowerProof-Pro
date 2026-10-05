"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Banknote, Pause, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getPayoutQueue, setPayoutStatus } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { AdminPayout } from "@/lib/types";

export default function AdminPayoutsPage() {
  const { data, loading, error, reload, setData } = useApi(getPayoutQueue, []);
  const [hold, setHold] = useState<AdminPayout | null>(null);

  const columns = useMemo<ColumnDef<AdminPayout, unknown>[]>(() => {
    const apply = (p: AdminPayout) => setData((data ?? []).map((x) => (x.id === p.id ? p : x)));
    return [
      { accessorKey: "storeName", header: "Store", cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> },
      { id: "amount", accessorFn: (p) => p.amount.amount, header: "Amount", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.amount} mono /> },
      { accessorKey: "method", header: "To", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "status", header: "Status", filterFn: "equals", cell: ({ row }) => (
        <span className="flex flex-col gap-1"><StatusPill status={row.original.status} />{row.original.note && <span className="text-xs text-muted-foreground">{row.original.note}</span>}</span>
      ) },
      { id: "req", accessorFn: (p) => p.requestedAt, header: "Requested", enableSorting: true, cell: ({ row }) => timeAgo(row.original.requestedAt) },
      { id: "actions", header: () => <span className="sr-only">Actions</span>, meta: { align: "right" }, cell: ({ row }) => {
        const p = row.original;
        if (p.status === "sent") return null;
        return (
          <span className="flex justify-end gap-1">
            <Button size="sm" variant="secondary" onClick={async () => { apply(await setPayoutStatus(p.id, "sent")); toast.success("Payout released", { description: `${p.storeName}` }); }}>
              <Send aria-hidden /> {p.status === "failed" ? "Retry" : "Release"}
            </Button>
            {p.status !== "on_hold" && <Button size="icon-sm" variant="ghost" aria-label={`Hold payout for ${p.storeName}`} onClick={() => setHold(p)}><Pause /></Button>}
          </span>
        );
      } },
    ];
  }, [data, setData]);

  return (
    <>
      <PageHeader title="Payouts queue" description="Withdrawals go out automatically. Anything flagged by risk rules or disputes waits here for you." />
      <DataTable
        label="Payout queue"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search store"
        filters={[{ columnId: "status", label: "Statuses", options: ["queued", "on_hold", "sent", "failed"].map((v) => ({ value: v, label: v.replace("_", " ") })) }]}
        empty={<EmptyState icon={Banknote} title="Queue's empty." body="Every payout has gone out." />}
      />
      <ConfirmDialog
        open={!!hold}
        onOpenChange={(o) => !o && setHold(null)}
        title={`Hold ${hold?.storeName}'s payout?`}
        description="The creator sees it as on hold and gets an email asking them to contact support. Money stays in their balance."
        confirmLabel="Hold payout"
        onConfirm={async () => {
          if (!hold) return;
          const p = await setPayoutStatus(hold.id, "on_hold");
          setData((data ?? []).map((x) => (x.id === p.id ? p : x)));
          toast.success("Payout on hold");
        }}
      />
    </>
  );
}
