"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { useApi } from "@/hooks/use-api";
import { getCustomers } from "@/lib/api";
import { countryShort, initials, timeAgo } from "@/lib/format";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const { data, loading, error, reload } = useApi(() => getCustomers(), [], { live: true });

  const countries = useMemo(
    () => [...new Set(data?.map((c) => c.countryCode))].map((c) => ({ value: c, label: countryShort(c) })),
    [data]
  );

  const columns = useMemo<ColumnDef<Customer, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (c) => `${c.name} ${c.email}`,
        header: "Customer",
        cell: ({ row }) => (
          <Link href={`/customers/${row.original.id}`} className="flex min-h-11 min-w-0 items-center gap-3">
            <Avatar className="size-9"><AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{initials(row.original.name)}</AvatarFallback></Avatar>
            <span className="flex flex-col">
              <span className="font-medium hover:underline">{row.original.name}</span>
              <span className="text-xs text-muted-foreground">{row.original.email}</span>
            </span>
          </Link>
        ),
      },
      { accessorKey: "countryCode", header: "Country", filterFn: "equals", cell: ({ getValue }) => countryShort(getValue() as string) },
      { accessorKey: "ordersCount", header: "Orders", enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as number}</span> },
      { id: "spent", accessorFn: (c) => c.totalSpent.amount, header: "Spent", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.totalSpent} mono /> },
      { id: "last", accessorFn: (c) => c.lastOrderAt, header: "Last order", enableSorting: true, cell: ({ row }) => timeAgo(row.original.lastOrderAt) },
    ],
    []
  );

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has bought from you. Their email is theirs; use it for receipts and replies, not spam." />
      <DataTable
        label="Customers"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search name or email"
        filters={[{ columnId: "countryCode", label: "Countries", options: countries }]}
        rowHref={(c) => `/customers/${c.id}`}
        mobileCard={(c) => (
          <Link href={`/customers/${c.id}`} className="flex items-center gap-3 rounded-card border bg-surface p-4">
            <Avatar className="size-10"><AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">{initials(c.name)}</AvatarFallback></Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.name}</span>
              <span className="block truncate text-sm text-muted-foreground">{c.ordersCount} order{c.ordersCount === 1 ? "" : "s"} · {countryShort(c.countryCode)}</span>
            </span>
            <MoneyText value={c.totalSpent} className="font-semibold" />
          </Link>
        )}
        empty={<EmptyState icon={Users} title="No customers yet." body="People who buy from you land here, with everything they've bought." />}
      />
    </>
  );
}
