"use client";

import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight, Clock, Landmark, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { PayoutMethodCard } from "@/components/pp/payout-method-card";
import { StatusPill } from "@/components/pp/status-pill";
import { BankForm } from "@/components/payouts/bank-form";
import { Statements } from "@/components/payouts/statements";
import { WithdrawDialog } from "@/components/payouts/withdraw-dialog";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { getBalance, getOrders, getPayoutMethods, getPayouts, getStore, usdtPlaceholder } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Payout } from "@/lib/types";

type Section = "balance" | "history" | "methods";
const SECTIONS: { value: Section; label: string }[] = [
  { value: "balance", label: "Balance" },
  { value: "history", label: "History" },
  { value: "methods", label: "Methods" },
];

function PayoutsInner({ section }: { section: Section }) {
  const params = useSearchParams();
  const router = useRouter();
  const balance = useApi(getBalance, [], { live: true });
  const payouts = useApi(getPayouts, [], { live: true });
  const methods = useApi(getPayoutMethods, [], { live: true });
  const orders = useApi(() => getOrders(), []);
  const store = useApi(getStore, []);
  const [withdrawOpen, setWithdrawOpen] = useState(params.get("withdraw") === "1");
  const [bankOpen, setBankOpen] = useState(false);
  const unsaved = useUnsavedGuard();

  const allMethods = methods.data?.some((m) => m.kind === "usdt") ? methods.data : [...(methods.data ?? []), usdtPlaceholder()];
  const hasBank = !!methods.data?.some((m) => m.kind === "bank");

  const columns = useMemo<ColumnDef<Payout, unknown>[]>(
    () => [
      { id: "date", accessorFn: (p) => p.createdAt, header: "Requested", enableSorting: true, cell: ({ row }) => formatDate(row.original.createdAt, { time: true }) },
      { id: "amount", accessorFn: (p) => p.amount.amount, header: "Amount", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.amount} mono className="font-medium" /> },
      { accessorKey: "methodLabel", header: "To" },
      { accessorKey: "status", header: "Status", filterFn: "equals", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
      { id: "ref", header: "Reference (UTR)", cell: ({ row }) => <span className="font-mono text-xs">{row.original.reference ?? "—"}</span> },
      { id: "arrived", header: "Arrived", cell: ({ row }) => (row.original.arrivedAt ? formatDate(row.original.arrivedAt) : <span className="text-muted-foreground">On its way</span>) },
    ],
    []
  );

  const openWithdraw = () => {
    if (!hasBank) {
      setBankOpen(true);
      toast("Add a bank account first", { description: "Then you can withdraw." });
      return;
    }
    setWithdrawOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Each sale is held for 3 hours, then it's yours to withdraw any time, any amount from ₹100.00."
        actions={
          <Button onClick={openWithdraw} disabled={!balance.data || balance.data.available.amount < 10000}>
            <ArrowUpRight aria-hidden /> Withdraw
          </Button>
        }
      />

      <nav aria-label="Payouts" className="mb-6">
        <ul className="flex gap-1 overflow-x-auto rounded-control bg-muted p-1 pointer-coarse:gap-2 sm:w-fit">
          {SECTIONS.map((t) => (
            <li key={t.value} className="shrink-0">
              <Link
                href={`/sales/payouts/${t.value}`}
                aria-current={section === t.value ? "page" : undefined}
                className={cn("inline-flex min-h-9 items-center rounded-[7px] border border-transparent px-3 text-sm font-medium pointer-coarse:min-h-11", section === t.value ? "border-border bg-surface text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {section !== "balance" ? null : balance.error ? (
        <ErrorState message={balance.error} onRetry={balance.reload} />
      ) : (
        <section aria-label="Balance" className="grid grid-cols-1 overflow-hidden rounded-card border bg-surface md:grid-cols-[1.3fr_1fr_1fr]">
          <div className="flex flex-col gap-1 border-b p-6 md:border-r md:border-b-0">
            <p className="eyebrow flex items-center gap-1.5"><Wallet className="size-3.5" aria-hidden /> Available now</p>
            {balance.data ? <MoneyText value={balance.data.available} className="font-display text-[2.5rem] leading-tight text-accent-strong" /> : <Skeleton className="h-12 w-48" />}
            <p className="text-sm text-muted-foreground">Yours to withdraw today.</p>
          </div>
          <div className="flex flex-col gap-1 border-b p-6 md:border-r md:border-b-0">
            <p className="eyebrow flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden /> Pending</p>
            {balance.data ? <MoneyText value={balance.data.pending} className="font-display text-[1.75rem] leading-tight" /> : <Skeleton className="h-9 w-36" />}
            <p className="text-sm text-muted-foreground">
              {balance.data?.nextReleaseAt ? `Next release ${formatDate(balance.data.nextReleaseAt)}. Includes refund requests on hold.` : "Recent sales are held for 3 hours before release."}
            </p>
          </div>
          <div className="flex flex-col gap-1 p-6">
            <p className="eyebrow">Paid out so far</p>
            {balance.data ? <MoneyText value={balance.data.lifetimePaidOut} className="font-display text-[1.75rem] leading-tight" /> : <Skeleton className="h-9 w-36" />}
            <p className="text-sm text-muted-foreground">Since {store.data ? formatDate(store.data.createdAt) : "you started"}.</p>
          </div>
        </section>
      )}

      {section === "methods" && (
      <section aria-labelledby="methods-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="methods-h" className="text-xl">Where money goes</h2>
          <Button variant="secondary" size="sm" data-coach="add-payout-method" onClick={() => setBankOpen(true)}><Plus aria-hidden /> {hasBank ? "Change bank" : "Add bank account"}</Button>
        </div>
        {methods.loading && !methods.data ? (
          <Skeleton className="h-20 rounded-card" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {!hasBank && (
              <button type="button" onClick={() => setBankOpen(true)} className="flex min-h-20 items-center gap-4 rounded-card border-2 border-dashed border-border-strong bg-surface p-4 text-left hover:border-primary">
                <span className="grid size-11 place-items-center rounded-control bg-primary-soft text-primary"><Landmark className="size-5" aria-hidden /></span>
                <span><span className="block font-semibold">Add a bank account</span><span className="text-sm text-muted-foreground">Takes a minute. Needed before your first withdrawal.</span></span>
              </button>
            )}
            {allMethods?.map((m) => <PayoutMethodCard key={m.id} method={m} />)}
          </div>
        )}
      </section>
      )}

      {section === "history" && (
      <section aria-labelledby="hist-h">
        <h2 id="hist-h" className="mb-3 text-xl">History</h2>
        <DataTable
          label="Payout history"
          columns={columns}
          data={payouts.data}
          loading={payouts.loading && !payouts.data}
          error={payouts.error}
          onRetry={payouts.reload}
          searchPlaceholder="Search by reference"
          filters={[{ columnId: "status", label: "Statuses", options: [{ value: "processing", label: "On its way" }, { value: "paid", label: "Paid" }, { value: "failed", label: "Failed" }] }]}
          mobileCard={(p) => (
            <div className="flex items-center gap-3 rounded-card border bg-surface p-4">
              <span className="min-w-0 flex-1">
                <MoneyText value={p.amount} className="block font-semibold" />
                <span className="block truncate text-sm text-muted-foreground">{formatDate(p.createdAt)} · {p.methodLabel}</span>
              </span>
              <StatusPill status={p.status} />
            </div>
          )}
          empty={<EmptyState nextStep icon={Wallet} title="No payouts yet." body="When you withdraw, it shows up here with the bank reference." compact />}
        />
      </section>
      )}

      {section === "balance" && (
        <section aria-labelledby="stmt-h" className="mt-8">
          <h2 id="stmt-h" className="mb-3 text-xl">Statements</h2>
          <Statements orders={orders.data ?? []} payouts={payouts.data ?? []} />
        </section>
      )}

      {balance.data && methods.data && (
        <WithdrawDialog
          open={withdrawOpen}
          onOpenChange={(o) => {
            setWithdrawOpen(o);
            if (!o && params.get("withdraw")) router.replace("/sales/payouts/balance");
          }}
          balance={balance.data}
          methods={allMethods ?? []}
          onDone={() => balance.reload()}
        />
      )}

      <Sheet open={bankOpen} onOpenChange={(o) => (o ? setBankOpen(true) : unsaved.confirmLeave(() => setBankOpen(false)))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">Bank account</SheetTitle>
            <SheetDescription>Payouts go here. We check it with a ₹1 deposit.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <BankForm
              formId="payout-bank"
              defaultName={store.data?.ownerName}
              saveBar
              onSaved={() => setBankOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function PayoutsPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  if (!SECTIONS.some((s) => s.value === section)) notFound();
  return (
    <Suspense>
      <PayoutsInner section={section as Section} />
    </Suspense>
  );
}
