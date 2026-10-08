"use client";

import { navHref } from "@/lib/nav/model";
import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { useApi } from "@/hooks/use-api";
import { getOrders } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { countryShort, formatDate, timeAgo } from "@/lib/format";
import type { Order } from "@/lib/types";


function exportCsv(rows: Order[]) {
  const head = ["Order", "Date", "Buyer", "Email", "Country", "Product", "Status", "Paid", "Settled INR", "Fees INR", "Net INR", "Invoice"];
  const lines = rows.map((o) =>
    [o.number, o.createdAt, o.buyerName, o.buyerEmail, o.country, o.productTitle, o.status, formatMoney(o.buyerTotal), (o.total.amount / 100).toFixed(2), ((o.fees.gateway.amount + o.fees.platform.amount) / 100).toFixed(2), (o.net.amount / 100).toFixed(2), o.invoiceNumber ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `powerproof-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function OrdersTable() {
  const params = useSearchParams();
  const productId = params.get("product") ?? undefined;
  const router = useRouter();
  const tab = (["paid", "refunded", "disputed"] as const).find((s) => s === params.get("status")) ?? "all";
  // "disputed" isn't an order status: it narrows the list to orders with an open dispute
  const disputed = tab === "disputed";
  const status = tab === "paid" || tab === "refunded" ? tab : null;
  const { data, loading, error, reload } = useApi(() => getOrders({ productId, disputed }), [productId, disputed], { live: true });

  const columns = useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      { accessorKey: "number", header: "Order", cell: ({ row }) => <Link href={`/sales/orders/${row.original.id}`} className="font-mono text-[0.8125rem] font-medium hover:underline">{row.original.number}</Link> },
      { id: "date", accessorFn: (o) => o.createdAt, header: "Date", enableSorting: true, cell: ({ row }) => <span title={formatDate(row.original.createdAt, { time: true })}>{timeAgo(row.original.createdAt)}</span> },
      {
        id: "buyer",
        accessorFn: (o) => `${o.buyerName} ${o.buyerEmail}`,
        header: "Buyer",
        cell: ({ row }) =>
          row.original.buyerEmail ? (
            <span className="flex flex-col">
              <span className="font-medium">{row.original.buyerName}</span>
              <span className="text-xs text-muted-foreground">{row.original.buyerEmail} · {countryShort(row.original.countryCode)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Checkout started</span>
          ),
      },
      { accessorKey: "productTitle", header: "Product", cell: ({ getValue }) => <span className="block max-w-[220px] truncate">{getValue() as string}</span> },
      { accessorKey: "status", header: "Status", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      {
        id: "total",
        accessorFn: (o) => o.total.amount,
        header: "Total",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="flex flex-col items-end">
            <MoneyText value={row.original.buyerTotal} mono className="font-medium" />
            {row.original.buyerTotal.currency !== "INR" && <MoneyText value={row.original.total} mono className="text-xs text-muted-foreground" />}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
    <StatusTabs
      label="Order status"
      value={tab}
      onChange={(v) => router.replace(v === "all" ? "/sales/orders" : `/sales/orders?status=${v}`, { scroll: false })}
      tabs={[
        { value: "all", label: "All" },
        { value: "paid", label: "Paid" },
        { value: "refunded", label: "Refunded" },
        { value: "disputed", label: "Disputed" },
      ]}
    />
    <DataTable
      key={tab}
      label="Orders"
      columns={columns}
      data={status ? data?.filter((o) => o.status === status) : data}
      loading={loading && !data}
      error={error}
      onRetry={reload}
      searchPlaceholder="Search order, buyer or product"
      rowHref={(o) => `/sales/orders/${o.id}`}
      toolbar={
        <Button variant="secondary" onClick={() => data && exportCsv(data)} disabled={!data?.length}>
          <Download aria-hidden /> Export CSV
        </Button>
      }
      mobileCard={(o) => (
        <Link href={`/sales/orders/${o.id}`} className="flex items-center gap-3 rounded-card border bg-surface p-4">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{o.number}</span>
              <span className="text-xs text-muted-foreground">· {timeAgo(o.createdAt)}</span>
            </span>
            <span className="block truncate font-semibold">{o.productTitle}</span>
            <span className="block truncate text-sm text-muted-foreground">{o.buyerName || "Checkout started"}</span>
          </span>
          <span className="flex flex-col items-end gap-1.5">
            <MoneyText value={o.buyerTotal} className="font-semibold" />
            <StatusPill status={o.status} />
          </span>
        </Link>
      )}
      empty={<EmptyState nextStep icon={Receipt} title="Nothing sold yet." body="Your first sale will show up here. Share your store link to get things going." action={<Button asChild><Link href={navHref("dashboard")}>Get your store link</Link></Button>} />}
    />
    </>
  );
}

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" description="Every sale, refund and attempt. Amounts show what the buyer paid, with the rupee settlement underneath." />
      <Suspense>
        <OrdersTable />
      </Suspense>
    </>
  );
}
