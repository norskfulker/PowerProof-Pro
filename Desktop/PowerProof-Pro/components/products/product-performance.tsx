"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendChart } from "@/components/pp/chart-card";
import { MoneyText } from "@/components/pp/money-text";
import { Segmented } from "@/components/pp/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getProductStats } from "@/lib/api";
import { formatNumber, sourceLabel } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Days = "7" | "30" | "90";
const DAY_MS = 86_400_000;

/**
 * How one product is doing over a period: who looked, who bought, what it earned, refunds, the
 * trend and where its viewers came from. On the product's page and in Analytics' drill-down.
 * `range` fixes the period (Analytics passes its own); otherwise a 7/30/90-day switch shows.
 */
export function ProductPerformance({ product, range, className }: { product: Pick<Product, "id" | "price">; range?: { from: Date; to: Date }; className?: string }) {
  const [days, setDays] = useState<Days>("30");
  // The end of the current hour, read once when the panel opens
  const [hour] = useState(() => Math.ceil(Date.now() / 3_600_000) * 3_600_000);
  const to = range?.to ?? new Date(hour);
  const from = range?.from ?? new Date(to.getTime() - Number(days) * DAY_MS);
  const { data, error, reload } = useApi(() => getProductStats(product, from, to), [product.id, from.getTime(), to.getTime()]);
  const stat = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-bold tabular">{value}</dd>
    </div>
  );

  return (
    <section className={cn("flex flex-col gap-4 rounded-card border bg-surface p-5 md:p-6", className)} aria-labelledby={`perf-${product.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`perf-${product.id}`} className="font-sans text-base font-semibold tracking-normal">Performance</h2>
        {!range && <Segmented label="Period" value={days} onChange={setDays} options={[{ value: "7", label: "7d" }, { value: "30", label: "30d" }, { value: "90", label: "90d" }]} />}
      </div>
      {error ? (
        <p className="text-sm text-danger">{error} <button type="button" className="underline" onClick={reload}>Try again</button></p>
      ) : !data ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {stat("Viewers", formatNumber(data.viewers))}
            {stat("Orders", formatNumber(data.orders))}
            {stat("Conversion", data.conversion === undefined ? "—" : `${data.conversion.toFixed(1)}%`)}
            {stat("Revenue", <MoneyText value={data.revenue} />)}
            {stat("Units", formatNumber(data.units))}
            {stat("Refunds", formatNumber(data.refunds))}
          </dl>
          {data.days.some((d) => d.revenue > 0) && (
            <TrendChart name="Revenue" tone="revenue" kind="money" currency={product.price.currency} height={140} data={data.days.map((d) => ({ label: d.day, value: d.revenue }))} />
          )}
          {data.sources.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Viewers came from</p>
              <ul className="flex flex-col gap-1 text-sm">
                {data.sources.map((s) => (
                  <li key={s.source} className="flex justify-between gap-3"><span>{sourceLabel(s.source)}</span><span className="font-mono tabular">{formatNumber(s.viewers)}</span></li>
                ))}
              </ul>
            </div>
          )}
          {data.orders > 0 && <Link href={`/sales/orders?product=${product.id}`} className="text-sm font-semibold text-primary underline underline-offset-4">See its orders</Link>}
        </>
      )}
    </section>
  );
}
