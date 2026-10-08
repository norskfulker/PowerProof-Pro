"use client";

import { MoneyText } from "@/components/pp/money-text";
import { NoData, StatCard } from "@/components/pp/stat-card";
import { ErrorState } from "@/components/pp/empty-state";
import { formatDate, formatNumber } from "@/lib/format";
import type { Balance, Summary } from "@/lib/types";

const RANGE_HINT: Record<Summary["range"], string> = {
  today: "vs yesterday",
  "7d": "vs last week",
  "30d": "vs last month",
  "90d": "vs prior 90 days",
};

export function Glance({
  summary,
  balance,
  loading,
  error,
  onRetry,
}: {
  summary?: Summary;
  balance?: Balance;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const s = summary;
  const hint = s ? RANGE_HINT[s.range] : undefined;
  const show = !loading && s;
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard label="Sales" loading={!show} value={s && formatNumber(s.sales)} delta={s?.deltas.sales} hint={hint} />
      <StatCard label="Revenue" loading={!show} value={s && <MoneyText value={s.revenue} />} delta={s?.deltas.revenue} hint={hint} />
      <StatCard label="Visitors" loading={!show} value={s && (s.visitors == null ? <NoData /> : formatNumber(s.visitors))} delta={s?.deltas.visitors} hint={s?.visitors == null ? "Visits couldn't be read" : hint} />
      <StatCard label="Conversion" loading={!show} value={s && (s.conversion == null ? <NoData /> : `${s.conversion.toFixed(1)}%`)} delta={s?.deltas.conversion} hint={s?.conversion == null ? "Needs visitor tracking" : "visitors who paid"} />
      <StatCard
        label="Available to withdraw"
        className="col-span-2 lg:col-span-1"
        loading={!balance}
        emphasis
        value={balance && <MoneyText value={balance.available} />}
        hint={
          balance &&
          (balance.pending.amount > 0 ? (
            <>
              + <MoneyText value={balance.pending} /> pending{balance.nextReleaseAt ? `, from ${formatDate(balance.nextReleaseAt)}` : ""}
            </>
          ) : (
            "Nothing pending"
          ))
        }
      />
    </div>
  );
}
