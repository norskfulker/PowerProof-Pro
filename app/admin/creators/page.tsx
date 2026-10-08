"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Users } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyList } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getAdminCreators, type AdminCreator } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { countryShort, formatDate, formatNumber, timeAgo } from "@/lib/format";
import { formatMoney } from "@/lib/money";

function Creators() {
  const q = useSearchParams().get("q") ?? "";
  const { data, loading, error, reload } = useApi(() => getAdminCreators(), [], { live: true });

  const columns = useMemo<ColumnDef<AdminCreator, unknown>[]>(
    () => [
      {
        id: "creator",
        accessorFn: (c) => `${c.name} ${c.email}`,
        header: "Creator",
        cell: ({ row }) => (
          <Link href={`/admin/stores?q=${encodeURIComponent(row.original.email)}`} className="flex flex-col hover:underline">
            <span className="font-medium">{row.original.name || row.original.email}</span>
            {row.original.name && <span className="text-xs text-muted-foreground">{row.original.email}</span>}
          </Link>
        ),
      },
      { accessorKey: "plan", header: "Plan", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} label={getValue() === "pro" ? "Pro" : "Free"} tone={getValue() === "pro" ? "brass" : "neutral"} /> },
      { id: "country", accessorFn: (c) => c.country ?? "", header: "Country", cell: ({ row }) => (row.original.country ? countryShort(row.original.country) : <span className="text-muted-foreground">Not set</span>) },
      {
        id: "stores",
        accessorFn: (c) => c.stores,
        header: "Stores",
        enableSorting: true,
        cell: ({ row }) => (
          <span>
            {formatNumber(row.original.stores)}
            {row.original.suspended > 0 && <span className="ml-2 text-xs font-semibold text-danger">{row.original.suspended} suspended</span>}
          </span>
        ),
      },
      { id: "orders", accessorFn: (c) => c.orders, header: "Paid orders", enableSorting: true, cell: ({ row }) => formatNumber(row.original.orders) },
      { id: "revenue", accessorFn: (c) => c.revenue.reduce((t, r) => t + r.amount, 0), header: "Sales", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyList values={row.original.revenue.map((r) => ({ amount: r.amount, currency: r.currency }))} mono className="items-end" /> },
      { id: "seen", accessorFn: (c) => c.lastSeenAt ?? "", header: "Last in the app", enableSorting: true, cell: ({ row }) => (row.original.lastSeenAt ? <span title={formatDate(row.original.lastSeenAt, { time: true })}>{timeAgo(row.original.lastSeenAt)}</span> : <span className="text-muted-foreground">Not since tracking began</span>) },
      { id: "joined", accessorFn: (c) => c.createdAt, header: "Joined", enableSorting: true, cell: ({ row }) => formatDate(row.original.createdAt) },
    ],
    []
  );

  return (
    <DataTable
      label="Creators"
      columns={columns}
      data={data}
      loading={loading && !data}
      error={error}
      onRetry={reload}
      initialSearch={q}
      searchPlaceholder="Search name or email"
      toolbar={
        <Button variant="secondary" disabled={!data?.length} onClick={() => data && downloadCsv("creators", [["Name", "Email", "Plan", "Country", "Stores", "Paid orders", "Sales", "Joined", "Last in the app"], ...data.map((c) => [c.name, c.email, c.plan, c.country ?? "", String(c.stores), String(c.orders), c.revenue.map((r) => formatMoney(r)).join(" + "), c.createdAt.slice(0, 10), c.lastSeenAt ?? ""])])}>
          <Download aria-hidden /> Export CSV
        </Button>
      }
      filters={[{ columnId: "plan", label: "Plans", options: [{ value: "free", label: "Free" }, { value: "pro", label: "Pro" }] }]}
      empty={<EmptyState icon={Users} title="No creators yet." body="People who sign up to sell will show up here." />}
    />
  );
}

export default function Page() {
  return (
    <>
      <title>Creators · PowerProof admin</title>
      <PageHeader title="Creators" description="Everyone who sells on PowerProof. Open one to see their stores." />
      <Suspense>
        <Creators />
      </Suspense>
    </>
  );
}
