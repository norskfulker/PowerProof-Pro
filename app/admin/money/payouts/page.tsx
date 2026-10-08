"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Banknote, Download, Info, Loader2 } from "lucide-react";
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
import { getAdminPayouts, getRates, sendPayoutWithRazorpay, setPayoutState, type AdminPayout } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/money";
import { planPayout, type PayoutPlan } from "@/lib/payout-plan";
import type { Rates } from "@/lib/fx";
import { formatDate, timeAgo } from "@/lib/format";

type Tab = "waiting" | "paid" | "failed" | "all";
const waiting = (p: AdminPayout) => p.status === "requested" || p.status === "processing";

export default function Page() {
  const { data, loading, error, reload } = useApi(() => getAdminPayouts(), [], { live: true });
  const [tab, setTab] = useState<Tab>("waiting");
  const [paid, setPaid] = useState<AdminPayout>();
  const [rates, setRates] = useState<Rates>({});
  const [autoReady, setAutoReady] = useState(false);
  const [sending, setSending] = useState<string>();
  useEffect(() => {
    getRates().then(setRates, () => undefined);
    fetch("/api/payments/status", { cache: "no-store" }).then((r) => r.json()).then((s: { payoutAccount?: boolean }) => setAutoReady(!!s.payoutAccount), () => undefined);
  }, []);
  const planFor = useCallback(
    (p: AdminPayout): PayoutPlan =>
      planPayout({ balanceCurrency: p.amount.currency, amountMinor: p.amount.amount, sellerCountry: p.storeCountry, methodKind: (p.methodKind as "bank" | "upi" | "crypto") || null, hasFundAccount: p.hasFundAccount, rates }),
    [rates]
  );
  const [failed, setFailed] = useState<AdminPayout>();

  const rows = useMemo(() => {
    if (!data || tab === "all") return data;
    if (tab === "waiting") return data.filter(waiting);
    if (tab === "paid") return data.filter((p) => p.status === "paid");
    return data.filter((p) => p.status === "failed" || p.status === "cancelled");
  }, [data, tab]);

  const columns = useMemo<ColumnDef<AdminPayout, unknown>[]>(
    () => [
      { id: "requested", accessorFn: (p) => p.requestedAt, header: "Asked", enableSorting: true, cell: ({ row }) => <span title={formatDate(row.original.requestedAt, { time: true })}>{timeAgo(row.original.requestedAt)}</span> },
      {
        id: "seller",
        accessorFn: (p) => `${p.storeName} ${p.ownerEmail}`,
        header: "Seller",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.storeName}</span>
            <span className="text-xs text-muted-foreground">{row.original.ownerEmail}</span>
          </span>
        ),
      },
      {
        id: "to",
        accessorFn: (p) => `${p.holder} ${p.method}`,
        header: "Send to",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.holder || "Unknown holder"}</span>
            <span className="font-mono text-xs text-muted-foreground">{row.original.method}</span>
          </span>
        ),
      },
      { id: "amount", accessorFn: (p) => p.amount.amount, header: "Balance withdrawn", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.amount} mono className="font-medium" /> },
      {
        id: "pays",
        header: "Pays out",
        cell: ({ row }) => {
          const p = row.original;
          if (p.sent) return <span className="flex flex-col"><MoneyText value={p.sent} mono className="font-medium" />{p.sent.currency !== p.amount.currency && p.sent.rate ? <span className="text-xs text-muted-foreground">1 {p.amount.currency} = {p.sent.rate.toFixed(4)} {p.sent.currency}</span> : null}</span>;
          if (!waiting(p)) return <span className="text-muted-foreground">—</span>;
          const plan = planFor(p);
          return (
            <span className="flex max-w-[260px] flex-col">
              <MoneyText value={{ amount: plan.amountMinor, currency: plan.currency }} mono className="font-medium" />
              <span className={plan.route === "razorpayx" ? "text-xs text-success" : "text-xs text-muted-foreground"}>{plan.route === "razorpayx" ? `Razorpay ${plan.mode}${plan.currency !== p.amount.currency ? `, converted from ${p.amount.currency}` : ""}` : plan.reason}</span>
            </span>
          );
        },
      },
      {
        id: "status",
        accessorFn: (p) => p.status,
        header: "Status",
        cell: ({ row }) => (
          <span className="flex flex-col gap-1">
            <StatusPill status={row.original.status} />
            {row.original.reference && <span className="font-mono text-xs text-muted-foreground">Ref {row.original.reference}</span>}
            {row.original.failureReason && <span className="max-w-[200px] text-xs text-danger">{row.original.failureReason}</span>}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) =>
          waiting(row.original) ? (
            <span className="flex justify-end gap-2">
              {row.original.status === "requested" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPayoutState(row.original.id, "processing").then(
                      () => toast.success("Marked as on its way"),
                      (e: Error) => toast.error(e.message)
                    )
                  }
                >
                  On its way
                </Button>
              )}
              {autoReady && !row.original.reference && planFor(row.original).route === "razorpayx" && (
                <Button
                  size="sm"
                  disabled={sending === row.original.id}
                  onClick={async () => {
                    setSending(row.original.id);
                    try {
                      const out = await sendPayoutWithRazorpay(row.original.id);
                      toast.success(`Sent ${formatMoney(out.amount)} through Razorpay. It closes by itself when Razorpay confirms.`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "The payout didn't go through.");
                    } finally {
                      setSending(undefined);
                    }
                  }}
                >
                  {sending === row.original.id && <Loader2 className="animate-spin" aria-hidden />} Send with Razorpay
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setPaid(row.original)}>Mark paid</Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setFailed(row.original)}>Failed</Button>
            </span>
          ) : null,
      },
    ],
    [planFor, autoReady, sending]
  );

  return (
    <>
      <title>Payout queue · PowerProof admin</title>
      <PageHeader title="Payout queue" description="Withdrawals waiting to be sent." />
      <div className="mb-5 flex gap-3 rounded-card border bg-info-soft px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p>
          Payouts are sent by hand for now. Send the money from your bank to the account shown, then mark the payout paid with the bank reference (UTR). If it can&apos;t be sent, mark it failed and the amount goes back to the seller&apos;s balance. Each step is written to the audit log.
        </p>
      </div>
      <StatusTabs
        label="Payout status"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "waiting", label: "To send", count: data?.filter(waiting).length },
          { value: "paid", label: "Sent", count: data?.filter((p) => p.status === "paid").length },
          { value: "failed", label: "Failed", count: data?.filter((p) => p.status === "failed" || p.status === "cancelled").length },
          { value: "all", label: "All", count: data?.length },
        ]}
      />
      <DataTable
        key={tab}
        label="Payouts"
        columns={columns}
        data={rows}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search seller or account"
        toolbar={
          <Button variant="secondary" disabled={!rows?.length} onClick={() => rows && downloadCsv("payouts", [["Asked", "Seller", "Owner", "Account", "Withdrawn", "Status", "Sent", "Reference"], ...rows.map((p) => [p.requestedAt.slice(0, 10), p.storeName, p.ownerEmail, p.method, formatMoney(p.amount), p.status, p.sent ? formatMoney(p.sent) : "", p.reference])])}>
            <Download aria-hidden /> Export CSV
          </Button>
        }
        empty={<EmptyState icon={Banknote} title="Nothing to send." body="When a seller withdraws their balance, the request lands here." />}
      />
      <ReasonDialog
        open={!!paid}
        onOpenChange={(o) => !o && setPaid(undefined)}
        title={`Mark ${paid ? "this payout" : ""} as paid?`}
        description={
          <>
            Confirm you sent <span className="font-semibold">{paid && <MoneyText value={paid.amount} />}</span> to {paid?.holder || "the seller"} ({paid?.method}). Enter the bank reference so it can be traced later.
          </>
        }
        confirmLabel="Mark paid"
        label="Bank reference (UTR)"
        placeholder="For example: 4091234567890"
        minLength={4}
        multiline={false}
        tone="primary"
        onConfirm={async (ref) => {
          await setPayoutState(paid!.id, "paid", { reference: ref });
          toast.success("Marked as paid");
        }}
      />
      <ReasonDialog
        open={!!failed}
        onOpenChange={(o) => !o && setFailed(undefined)}
        title="Mark this payout as failed?"
        description="The amount returns to the seller's balance so they can ask again. They will see the reason you write."
        confirmLabel="Mark failed"
        label="Reason"
        placeholder="For example: the bank returned the transfer, account closed"
        onConfirm={async (reason) => {
          await setPayoutState(failed!.id, "failed", { reason });
          toast.success("Marked as failed; the money is back in the seller's balance");
        }}
      />
    </>
  );
}
