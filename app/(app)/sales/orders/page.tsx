"use client";

import { navHref } from "@/lib/nav/model";
import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { useApi } from "@/hooks/use-api";
import { getOrders } from "@/lib/api";
import { formatMoney, money } from "@/lib/money";
import { countryShort, formatDate, timeAgo } from "@/lib/format";
import type { Order } from "@/lib/types";


const PAY: Record<string, string> = { upi: "UPI", card: "Card", netbanking: "Netbanking", wallet: "Wallet" };
const payOf = (o: Order) => (o.payment === "cod" ? "Cash on delivery" : o.paymentMethod ? PAY[o.paymentMethod] : o.status === "pending" || o.status === "failed" ? "—" : "Online");
/** Money the creator keeps: paid or cash collected, not refunded or failed */
const counts = (o: Order) => o.status === "paid" || o.status === "cod" || o.status === "refund_requested";

function OrdersTable() {
  const params = useSearchParams();
  const productId = params.get("product") ?? undefined;
  const router = useRouter();
  const tab = (["ship", "paid", "cod", "refunded", "disputed"] as const).find((s) => s === params.get("status")) ?? "all";
  // "disputed" isn't an order status: it narrows the list to orders with an open dispute; "ship" to orders waiting to be sent
  const disputed = tab === "disputed";
  const toShip = tab === "ship";
  const status = tab === "paid" || tab === "refunded" || tab === "cod" ? tab : null;
  const { data, loading, error, reload } = useApi(() => getOrders({ productId, disputed, toShip }), [productId, disputed, toShip], { live: true });
  const shipping = data?.some((o) => o.fulfilment) ?? false;

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
      {
        id: "items",
        accessorFn: (o) => o.items.map((i) => i.title).join(" ") || o.productTitle,
        header: "Items",
        cell: ({ row }) => {
          const o = row.original;
          const units = o.items.reduce((t, i) => t + (i.quantity ?? 1), 0);
          return (
            <span className="flex max-w-[240px] flex-col">
              <span className="truncate">{o.productTitle}</span>
              {(o.items.length > 1 || units > 1) && <span className="text-xs text-muted-foreground">{o.items.length > 1 ? `+${o.items.length - 1} more · ` : ""}{units} item{units === 1 ? "" : "s"}</span>}
            </span>
          );
        },
      },
      {
        id: "payment",
        accessorFn: (o) => (o.payment === "cod" ? "cod" : "online"),
        header: "Payment",
        filterFn: "equals",
        cell: ({ row }) => (
          <span className="flex flex-col whitespace-nowrap">
            <span>{payOf(row.original)}</span>
            {row.original.couponCode && <span className="font-mono text-xs text-muted-foreground">{row.original.couponCode}</span>}
          </span>
        ),
      },
      { id: "country", accessorFn: (o) => o.countryCode, header: "Country", filterFn: "equals", cell: ({ row }) => countryShort(row.original.countryCode) },
      { id: "discount", accessorFn: (o) => (o.discount?.amount ?? 0) + (o.dealSaving?.amount ?? 0), header: "Discount", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => { const d = (row.original.discount?.amount ?? 0) + (row.original.dealSaving?.amount ?? 0); return d ? <MoneyText value={money(d, row.original.total.currency)} mono className="text-success" /> : <span className="text-muted-foreground">—</span>; } },
      { id: "shipping", accessorFn: (o) => o.shipping?.amount ?? 0, header: "Shipping", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => (row.original.shipping?.amount ? <MoneyText value={row.original.shipping} mono /> : <span className="text-muted-foreground">—</span>) },
      { id: "fees", accessorFn: (o) => o.fees.gateway.amount + o.fees.platform.amount, header: "Fees", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={money(row.original.fees.gateway.amount + row.original.fees.platform.amount, row.original.total.currency)} mono className="text-muted-foreground" /> },
      { id: "net", accessorFn: (o) => o.net.amount, header: "You keep", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.net} mono /> },
      {
        accessorKey: "status",
        header: "Status",
        filterFn: "equals",
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            <StatusPill status={row.original.status} />
            {row.original.fulfilment && row.original.status !== "refunded" && row.original.status !== "failed" && <StatusPill status={row.original.fulfilment} />}
          </span>
        ),
      },
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
        ...(shipping || tab === "ship" || tab === "cod" ? [{ value: "ship" as const, label: "To ship" }, { value: "cod" as const, label: "Cash on delivery" }] : []),
        { value: "paid", label: "Paid" },
        { value: "refunded", label: "Refunded" },
        { value: "disputed", label: "Disputed" },
      ]}
    />
    <DataTable
      key={tab}
      label="Orders"
      rowId={(o) => o.id}
      selectable
      defaultHidden={["country", "discount", "shipping", "fees"]}
      dateFilter={{ get: (o) => o.createdAt, label: "Order date" }}
      filters={[
        ...(data?.some((o) => o.payment === "cod") ? [{ columnId: "payment", label: "Payments", options: [{ value: "online", label: "Paid online" }, { value: "cod", label: "Cash on delivery" }] }] : []),
        ...(new Set(data?.map((o) => o.countryCode)).size > 1 ? [{ columnId: "country", label: "Countries", options: [...new Set(data?.map((o) => o.countryCode))].map((c) => ({ value: c, label: countryShort(c) })) }] : []),
      ]}
      summary={(rows) => {
        const kept = rows.filter(counts);
        const cur = rows[0]?.total.currency ?? "INR";
        const gross = kept.reduce((t, o) => t + o.total.amount, 0);
        const refunded = rows.filter((o) => o.status === "refunded");
        return [
          { label: "Orders", value: rows.length.toLocaleString("en-IN"), hint: `${kept.length} paid${rows.some((o) => o.status === "cod") ? ", cash on delivery included" : ""}` },
          { label: "Sales", value: <MoneyText value={money(gross, cur)} /> },
          { label: "You keep", value: <MoneyText value={money(kept.reduce((t, o) => t + o.net.amount, 0), cur)} />, hint: "After fees" },
          { label: "Average order", value: kept.length ? <MoneyText value={money(Math.round(gross / kept.length), cur)} /> : "—" },
          { label: "Refunded", value: refunded.length, hint: refunded.length ? <MoneyText value={money(refunded.reduce((t, o) => t + o.total.amount, 0), cur)} /> : "None" },
        ];
      }}
      csv={{
        filename: "powerproof-orders",
        columns: [
          { header: "Order", value: (o) => o.number },
          { header: "Date", value: (o) => o.createdAt },
          { header: "Buyer", value: (o) => o.buyerName },
          { header: "Email", value: (o) => o.buyerEmail },
          { header: "Phone", value: (o) => o.buyerPhone },
          { header: "Country", value: (o) => o.country },
          { header: "Items", value: (o) => o.items.map((i) => `${i.title}${(i.quantity ?? 1) > 1 ? ` x${i.quantity}` : ""}`).join("; ") || o.productTitle },
          { header: "Status", value: (o) => o.status },
          { header: "Fulfilment", value: (o) => o.fulfilment ?? "" },
          { header: "Payment", value: payOf },
          { header: "Coupon", value: (o) => o.couponCode },
          { header: "Paid", value: (o) => formatMoney(o.buyerTotal) },
          { header: "Settled", value: (o) => (o.total.amount / 100).toFixed(2) },
          { header: "Shipping", value: (o) => ((o.shipping?.amount ?? 0) / 100).toFixed(2) },
          { header: "Fees", value: (o) => ((o.fees.gateway.amount + o.fees.platform.amount) / 100).toFixed(2) },
          { header: "Net", value: (o) => (o.net.amount / 100).toFixed(2) },
          { header: "Invoice", value: (o) => o.invoiceNumber },
          { header: "Tracking", value: (o) => o.tracking?.number },
        ],
      }}
      columns={columns}
      data={status ? data?.filter((o) => o.status === status) : data}
      loading={loading && !data}
      error={error}
      onRetry={reload}
      searchPlaceholder="Search order, buyer or product"
      rowHref={(o) => `/sales/orders/${o.id}`}
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
            {o.fulfilment && o.status !== "refunded" && o.status !== "failed" && <StatusPill status={o.fulfilment} />}
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
      <PageHeader
        title="Orders"
        description="Every sale, refund and attempt. Amounts show what the buyer paid, with the rupee settlement underneath."
        actions={
          <Button asChild variant="secondary"><Link href={navHref("dashboard")}>Get your store link</Link></Button>
        }
      />
      <Suspense>
        <OrdersTable />
      </Suspense>
    </>
  );
}
