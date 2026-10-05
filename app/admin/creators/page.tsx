"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getCreators, setCreatorPlan } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AdminCreator } from "@/lib/types";

export default function AdminCreatorsPage() {
  return (
    <Suspense>
      <AdminCreatorsPageInner />
    </Suspense>
  );
}

function AdminCreatorsPageInner() {
  const q = useSearchParams().get("q") ?? "";
  const { data, loading, error, reload, setData } = useApi(() => getCreators(), []);
  const [suspend, setSuspend] = useState<AdminCreator | null>(null);

  const update = (c: AdminCreator) => data && setData(data.map((x) => (x.id === c.id ? c : x)));

  const columns = useMemo<ColumnDef<AdminCreator, unknown>[]>(
    () => [
      { id: "store", accessorFn: (c) => `${c.storeName} ${c.ownerName} ${c.email}`, header: "Store", cell: ({ row }) => (
        <span className="flex flex-col"><span className="font-medium">{row.original.storeName}</span><span className="text-xs text-muted-foreground">{row.original.ownerName} · {row.original.email}</span></span>
      ) },
      { accessorKey: "city", header: "City" },
      { accessorKey: "plan", header: "Plan", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { accessorKey: "kyc", header: "KYC", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { accessorKey: "risk", header: "Risk", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { id: "gmv", accessorFn: (c) => c.gmv30d.amount, header: "GMV 30d", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.gmv30d} mono /> },
      { accessorKey: "orders30d", header: "Orders", enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as number}</span> },
      { id: "joined", accessorFn: (c) => c.joinedAt, header: "Joined", enableSorting: true, cell: ({ row }) => formatDate(row.original.joinedAt) },
      { id: "actions", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.storeName}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => window.open(`/s/${row.original.slug}`, "_blank")}>Open store</DropdownMenuItem>
            {row.original.plan === "suspended" ? (
              <DropdownMenuItem onSelect={async () => { update(await setCreatorPlan(row.original.id, "active")); toast.success("Store reactivated"); }}>Reactivate</DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onSelect={() => setSuspend(row.original)}>Suspend store</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  return (
    <>
      <PageHeader title="Creators" description="Every store on the platform. Suspending hides the store and pauses payouts." />
      <DataTable
        key={q}
        initialSearch={q}
        label="Creators"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search store, owner or email"
        filters={[
          { columnId: "plan", label: "Plans", options: ["active", "trial", "past_due", "suspended"].map((v) => ({ value: v, label: v.replace("_", " ") })) },
          { columnId: "kyc", label: "KYC", options: ["verified", "pending", "rejected"].map((v) => ({ value: v, label: v })) },
          { columnId: "risk", label: "Risk", options: ["low", "medium", "high"].map((v) => ({ value: v, label: v })) },
        ]}
      />
      <ConfirmDialog
        open={!!suspend}
        onOpenChange={(o) => !o && setSuspend(null)}
        title={`Suspend ${suspend?.storeName}?`}
        description="Their store goes offline, checkout stops and payouts pause. Existing buyers keep downloads. You can reactivate later."
        confirmLabel="Suspend"
        onConfirm={async () => {
          if (!suspend) return;
          update(await setCreatorPlan(suspend.id, "suspended"));
          toast.success("Store suspended", { description: suspend.storeName });
        }}
      />
    </>
  );
}
