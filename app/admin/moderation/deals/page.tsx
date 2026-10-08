"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, Tag } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { getAdminDeals, verifyDeal, type AdminDeal } from "@/lib/api";
import { discountPercent } from "@/lib/money";
import { formatDate, timeAgo } from "@/lib/format";

type Tab = "todo" | "verified" | "all";

export default function Page() {
  const { data, loading, error, reload } = useApi(() => getAdminDeals(), [], { live: true });
  const [tab, setTab] = useState<Tab>("todo");
  const todo = (d: AdminDeal) => !d.verified && d.status === "live";
  const rows = useMemo(() => (tab === "all" ? data : data?.filter((d) => (tab === "todo" ? !d.verified && d.status === "live" : d.verified))), [data, tab]);

  const columns = useMemo<ColumnDef<AdminDeal, unknown>[]>(
    () => [
      { id: "listed", accessorFn: (d) => d.createdAt, header: "Listed", enableSorting: true, cell: ({ row }) => timeAgo(row.original.createdAt) },
      {
        id: "deal",
        accessorFn: (d) => `${d.title} ${d.storeName}`,
        header: "Deal",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.title}</span>
            <span className="text-xs text-muted-foreground">{row.original.storeName} · {row.original.billing === "subscription" ? "Subscription" : "One-time"}</span>
          </span>
        ),
      },
      {
        id: "price",
        accessorFn: (d) => d.price.amount,
        header: "Price",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="flex flex-col items-end">
            <MoneyText value={row.original.price} mono className="font-medium" />
            <span className="text-xs text-muted-foreground"><s>{<MoneyText value={row.original.original} />}</s> · {discountPercent(row.original.price, row.original.original)}% off</span>
          </span>
        ),
      },
      { id: "ends", accessorFn: (d) => d.endsAt ?? "", header: "Ends", cell: ({ row }) => (row.original.endsAt ? formatDate(row.original.endsAt) : <span className="text-muted-foreground">No end date</span>) },
      { id: "status", accessorFn: (d) => d.status, header: "Status", cell: ({ row }) => <StatusPill status={row.original.status === "live" ? "live" : "paused"} /> },
      {
        id: "verified",
        accessorFn: (d) => d.verified,
        header: "Checked",
        cell: ({ row }) => (row.original.verified ? <StatusPill status="verified" /> : <span className="text-muted-foreground">Not yet</span>),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) => (
          <Button
            size="sm"
            variant={row.original.verified ? "ghost" : "secondary"}
            onClick={() =>
              verifyDeal(row.original.id, !row.original.verified).then(
                () => toast.success(row.original.verified ? "Verified badge removed" : "Deal verified"),
                (e: Error) => toast.error(e.message)
              )
            }
          >
            {row.original.verified ? "Remove badge" : "Verify"}
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <>
      <title>Marketplace deals · PowerProof admin</title>
      <PageHeader title="Marketplace deals" description="Deals creators list in the marketplace. A verified badge tells buyers staff checked the seller and the offer. Check the original price is real before you verify." />
      <StatusTabs
        label="Deal status"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "todo", label: "To check", count: data?.filter(todo).length },
          { value: "verified", label: "Verified", count: data?.filter((d) => d.verified).length },
          { value: "all", label: "All", count: data?.length },
        ]}
      />
      <DataTable
        key={tab}
        label="Marketplace deals"
        columns={columns}
        data={rows}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search deal or store"
        empty={<EmptyState icon={tab === "verified" ? BadgeCheck : Tag} title="No deals here." body="Deals appear as soon as a creator lists one in the marketplace." />}
      />
    </>
  );
}
