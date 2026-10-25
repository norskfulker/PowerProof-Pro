"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard } from "lucide-react";
import { PaymentEventList } from "@/components/orders/payment-events";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { LiveStatusBadge } from "@/components/pp/live-status";
import { PageHeader } from "@/components/pp/page-header";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useLiveStore } from "@/hooks/use-live-store";
import { getPaymentEvents, type PaymentEvent } from "@/lib/api/activity";
import type { PaymentEventKind } from "@/lib/payment-events";

type Filter = "all" | "succeeded" | "attention" | "pending" | "refunds";
const FILTERS: { value: Filter; label: string; kinds?: PaymentEventKind[] }[] = [
  { value: "all", label: "All" },
  { value: "succeeded", label: "Successful", kinds: ["succeeded"] },
  { value: "attention", label: "Failed and abandoned", kinds: ["failed", "abandoned", "cancelled", "expired", "late_payment", "disputed"] },
  { value: "pending", label: "Pending", kinds: ["initiated", "pending"] },
  { value: "refunds", label: "Refunds", kinds: ["refund_requested", "refund_processing", "refunded", "refund_failed"] },
];
const RANGES = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

/**
 * Payments: every step of every order's payment, live. Successes, pending and started payments,
 * failures with the provider's exact reason and code, abandoned payment windows, expiries (no
 * payment within the hour), refunds by stage, and payments that arrived after cancellation.
 * Each row says whether the provider confirmed it or the app recorded it.
 */
export default function PaymentsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [days, setDays] = useState("7");
  // Worked out when the request runs, so a reload looks back from the moment it's made
  const since = () => new Date(Date.now() - Number(days) * 86_400_000).toISOString();
  const kinds = FILTERS.find((f) => f.value === filter)?.kinds;
  const { data, loading, error, reload } = useApi(() => getPaymentEvents({ since: since(), kinds, limit: 300 }), [days, filter]);
  const all = useApi(() => getPaymentEvents({ since: since(), limit: 1000 }), [days]);
  const live = useLiveStore(["payment_events"], () => {
    reload();
    all.reload();
  });

  // New rows glow for a moment
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.map((e) => e.id));
      return;
    }
    const arrivals = data.filter((e) => !seen.current!.has(e.id)).map((e) => e.id);
    arrivals.forEach((id) => seen.current!.add(id));
    if (!arrivals.length) return;
    const a = setTimeout(() => setFresh(new Set(arrivals)), 0);
    const b = setTimeout(() => setFresh(new Set()), 4000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [data]);

  const count = (pick: (e: PaymentEvent) => boolean) => all.data?.filter(pick).length;
  const stats = [
    { label: "Successful", value: count((e) => e.kind === "succeeded"), tone: "text-success" },
    { label: "Failed", value: count((e) => e.kind === "failed"), tone: "text-danger" },
    { label: "Abandoned", value: count((e) => e.kind === "abandoned"), tone: "text-warning-ink" },
    { label: "Expired", value: count((e) => e.kind === "expired"), tone: "text-muted-foreground" },
    { label: "Refunds", value: count((e) => e.kind.startsWith("refund")), tone: "text-foreground" },
  ];

  return (
    <>
      <PageHeader title="Payments" actions={<LiveStatusBadge status={live} />} />
      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-card border bg-border sm:grid-cols-5" aria-label="Payment summary">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 bg-surface px-4 py-3">
            <dt className="eyebrow">{s.label}</dt>
            <dd className={`font-display text-xl font-bold tabular-nums ${s.tone}`}>{s.value === undefined ? <Skeleton className="h-6 w-10" /> : s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b">
        <StatusTabs label="Payment status" value={filter} onChange={setFilter} tabs={FILTERS.map((f) => ({ value: f.value, label: f.label }))} className="mb-0 border-b-0" />
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger size="sm" className="mb-2 w-40" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <section aria-label="Payment activity" className="overflow-hidden rounded-card border bg-surface">
        {error ? (
          <ErrorState className="m-4" message={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="flex flex-col gap-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : data && data.length ? (
          <PaymentEventList events={data} showOrder fresh={fresh} />
        ) : (
          <EmptyState compact className="m-4 border-0" icon={CreditCard} title="No payment activity in this period." body="Payments, failures, abandoned checkouts and refunds appear here the moment they happen." />
        )}
      </section>
      <p className="mt-3 text-xs text-muted-foreground">
        &ldquo;Provider&rdquo; rows were confirmed by the payment gateway; &ldquo;App&rdquo; rows were recorded by PowerProof (a payment window closed, an order cancelled after an hour, a refund sent). Reasons are the gateway&apos;s own words; when it gives none, the row says so.
      </p>
    </>
  );
}
