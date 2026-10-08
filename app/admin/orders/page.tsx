"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/pp/confirm-dialog";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { adminRefundOrder, getAdminOrders, revealBuyerPhone, type AdminOrder } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { countryShort, formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

type Tab = "all" | "paid" | "refunded" | "unpaid";

function Orders() {
  const q = useSearchParams().get("q") ?? "";
  const { data, loading, error, reload } = useApi(() => getAdminOrders(), [], { live: true });
  const [tab, setTab] = useState<Tab>("all");
  const [phoneFor, setPhoneFor] = useState<AdminOrder>();
  const [refundFor, setRefundFor] = useState<AdminOrder>();

  const rows = useMemo(() => {
    if (!data) return data;
    if (tab === "paid") return data.filter((o) => o.status === "paid");
    if (tab === "refunded") return data.filter((o) => o.status === "refunded");
    if (tab === "unpaid") return data.filter((o) => o.status === "pending" || o.status === "failed");
    return data;
  }, [data, tab]);
  const count = (f: (o: AdminOrder) => boolean) => data?.filter(f).length;

  const columns = useMemo<ColumnDef<AdminOrder, unknown>[]>(
    () => [
      { accessorKey: "number", header: "Order", cell: ({ getValue }) => <span className="font-mono text-[0.8125rem] font-medium">{getValue() as string}</span> },
      { id: "date", accessorFn: (o) => o.createdAt, header: "Date", enableSorting: true, cell: ({ row }) => formatDate(row.original.createdAt, { time: true }) },
      { accessorKey: "storeName", header: "Store", cell: ({ row }) => <Link href={`/admin/stores?q=${encodeURIComponent(row.original.storeName)}`} className="hover:underline">{row.original.storeName}</Link> },
      {
        id: "buyer",
        accessorFn: (o) => `${o.buyerName} ${o.buyerEmail}`,
        header: "Buyer",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.buyerName}</span>
            <span className="text-xs text-muted-foreground">{row.original.buyerEmail}{row.original.country ? ` · ${countryShort(row.original.country)}` : ""}</span>
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (o) => o.status,
        header: "Status",
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            <StatusPill status={row.original.status} />
            {row.original.disputed && <StatusPill status="open" label="Disputed" tone="danger" />}
          </span>
        ),
      },
      { id: "total", accessorFn: (o) => o.total.amount, header: "Total", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.total} mono className="font-medium" /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPhoneFor(row.original)}>Buyer phone</Button>
            {row.original.status === "paid" && (
              <Button size="sm" variant="secondary" onClick={() => setRefundFor(row.original)}>Refund</Button>
            )}
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
        onChange={setTab}
        tabs={[
          { value: "all", label: "All", count: data?.length },
          { value: "paid", label: "Paid", count: count((o) => o.status === "paid") },
          { value: "refunded", label: "Refunded", count: count((o) => o.status === "refunded") },
          { value: "unpaid", label: "Not paid", count: count((o) => o.status === "pending" || o.status === "failed") },
        ]}
      />
      <DataTable
        key={tab}
        label="Orders"
        columns={columns}
        data={rows}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        initialSearch={q}
        searchPlaceholder="Search order, buyer or store"
        toolbar={
          <Button variant="secondary" disabled={!rows?.length} onClick={() => rows && downloadCsv("orders", [["Order", "Date", "Store", "Buyer", "Email (hidden)", "Country", "Status", "Total"], ...rows.map((r) => [r.number, r.createdAt, r.storeName, r.buyerName, r.buyerEmail, r.country ?? "", r.status, formatMoney(r.total)])])}>
            <Download aria-hidden /> Export CSV
          </Button>
        }
        empty={<EmptyState icon={Receipt} title="No orders yet." body="Orders from every store appear here." />}
      />
      <ReasonDialog
        open={!!phoneFor}
        onOpenChange={(o) => !o && setPhoneFor(undefined)}
        title="Show this buyer's phone number?"
        description={`Phone numbers are private. Say why you need ${phoneFor?.buyerName ?? "this buyer"}'s number; the reason and your name are written to the audit log.`}
        confirmLabel="Show number"
        tone="primary"
        placeholder="For example: buyer asked us to call about order issue"
        onConfirm={async (reason) => {
          const phone = await revealBuyerPhone(phoneFor!.id, reason);
          toast(phone || "No phone number on this order", { description: `Order ${phoneFor!.number}`, duration: 20000 });
        }}
      />
      <ReasonDialog
        open={!!refundFor}
        onOpenChange={(o) => !o && setRefundFor(undefined)}
        title={`Refund order ${refundFor?.number ?? ""}?`}
        description={
          <>
            The buyer gets the full <span className="font-semibold">{refundFor && <MoneyText value={refundFor.total} />}</span> back on their original payment method, and the seller&apos;s earnings are reduced to match. This can&apos;t be undone.
          </>
        }
        confirmLabel="Refund the buyer"
        placeholder="Why is this order being refunded?"
        onConfirm={async (reason) => {
          await adminRefundOrder(refundFor!.id, reason);
          toast.success(`Order ${refundFor!.number} refunded`);
        }}
      />
    </>
  );
}

export default function Page() {
  return (
    <>
      <title>Orders · PowerProof admin</title>
      <PageHeader title="Orders" description="Orders across all stores. Buyer emails are partly hidden; the phone number needs a reason." />
      <Suspense>
        <Orders />
      </Suspense>
    </>
  );
}
