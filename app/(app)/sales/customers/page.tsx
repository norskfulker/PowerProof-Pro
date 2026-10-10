"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { useApi } from "@/hooks/use-api";
import { getCustomers } from "@/lib/api";
import { countryShort, formatDate, initials, timeAgo } from "@/lib/format";
import { money } from "@/lib/money";
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
          <Link href={`/sales/customers/${row.original.id}`} className="flex min-h-11 min-w-0 items-center gap-3">
            <Avatar className="size-9"><AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{initials(row.original.name)}</AvatarFallback></Avatar>
            <span className="flex flex-col">
              <span className="font-medium hover:underline">{row.original.name}</span>
              <span className="text-xs text-muted-foreground">{row.original.email}</span>
            </span>
          </Link>
        ),
      },
      {
        id: "type",
        accessorFn: (c) => (c.ordersCount > 1 ? "repeat" : "new"),
        header: "Type",
        filterFn: "equals",
        cell: ({ row }) => (row.original.ordersCount > 1 ? <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">Repeat</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">One order</span>),
      },
      { accessorKey: "countryCode", header: "Country", filterFn: "equals", cell: ({ getValue }) => countryShort(getValue() as string) },
      { accessorKey: "ordersCount", header: "Orders", enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as number}</span> },
      { id: "spent", accessorFn: (c) => c.totalSpent.amount, header: "Spent", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.totalSpent} mono /> },
      { id: "avg", accessorFn: (c) => (c.ordersCount ? c.totalSpent.amount / c.ordersCount : 0), header: "Average order", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={money(Math.round(row.original.totalSpent.amount / Math.max(1, row.original.ordersCount)), row.original.totalSpent.currency)} mono className="text-muted-foreground" /> },
      { id: "first", accessorFn: (c) => c.firstOrderAt, header: "Customer since", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap" title={formatDate(row.original.firstOrderAt)}>{formatDate(row.original.firstOrderAt)}</span> },
      { id: "last", accessorFn: (c) => c.lastOrderAt, header: "Last order", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap" title={formatDate(row.original.lastOrderAt, { time: true })}>{timeAgo(row.original.lastOrderAt)}</span> },
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone who has bought from you. Their email is theirs; use it for receipts and replies, not spam."
        actions={
          <Button asChild variant="secondary"><Link href="/dashboard">Get your store link</Link></Button>
        }
      />
      <DataTable
        label="Customers"
        columns={columns}
        data={data}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search name or email"
        filters={[
          { columnId: "type", label: "Customers", options: [{ value: "repeat", label: "Repeat buyers" }, { value: "new", label: "One order" }] },
          ...(countries.length > 1 ? [{ columnId: "countryCode", label: "Countries", options: countries }] : []),
        ]}
        rowId={(c) => c.id}
        selectable
        bulkActions={(list) => (
          <Button size="sm" variant="secondary" asChild>
            <a href={`mailto:?bcc=${encodeURIComponent(list.map((c) => c.email).join(","))}`}>Email {list.length}</a>
          </Button>
        )}
        defaultHidden={["first"]}
        dateFilter={{ get: (c) => c.lastOrderAt, label: "Last order" }}
        summary={(rows) => {
          const cur = rows[0]?.totalSpent.currency ?? "INR";
          const total = rows.reduce((t, c) => t + c.totalSpent.amount, 0);
          const repeat = rows.filter((c) => c.ordersCount > 1).length;
          const orders = rows.reduce((t, c) => t + c.ordersCount, 0);
          return [
            { label: "Customers", value: rows.length.toLocaleString("en-IN") },
            { label: "Repeat buyers", value: repeat, hint: rows.length ? `${Math.round((repeat / rows.length) * 100)}% came back` : undefined },
            { label: "Total spent", value: <MoneyText value={money(total, cur)} /> },
            { label: "Per customer", value: rows.length ? <MoneyText value={money(Math.round(total / rows.length), cur)} /> : "—", hint: rows.length ? `${(orders / rows.length).toFixed(1)} orders each` : undefined },
          ];
        }}
        csv={{
          filename: "powerproof-customers",
          columns: [
            { header: "Name", value: (c) => c.name },
            { header: "Email", value: (c) => c.email },
            { header: "Country", value: (c) => c.country },
            { header: "Orders", value: (c) => c.ordersCount },
            { header: "Spent", value: (c) => (c.totalSpent.amount / 100).toFixed(2) },
            { header: "Currency", value: (c) => c.totalSpent.currency },
            { header: "First order", value: (c) => c.firstOrderAt },
            { header: "Last order", value: (c) => c.lastOrderAt },
          ],
        }}
        rowHref={(c) => `/sales/customers/${c.id}`}
        mobileCard={(c) => (
          <Link href={`/sales/customers/${c.id}`} className="flex items-center gap-3 rounded-card border bg-surface p-4">
            <Avatar className="size-10"><AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">{initials(c.name)}</AvatarFallback></Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.name}</span>
              <span className="block truncate text-sm text-muted-foreground">{c.ordersCount} order{c.ordersCount === 1 ? "" : "s"} · {countryShort(c.countryCode)}</span>
            </span>
            <MoneyText value={c.totalSpent} className="font-semibold" />
          </Link>
        )}
        empty={<EmptyState nextStep icon={Users} title="No customers yet." body="People who buy from you land here, with everything they've bought." action={<Button asChild><Link href="/dashboard">Get your store link</Link></Button>} />}
      />
    </>
  );
}
