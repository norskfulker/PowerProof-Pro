"use client";

import { useState } from "react";
import Link from "next/link";
import { Plug } from "lucide-react";
import { Segmented } from "@/components/pp/segmented";
import { ChartCard, RevenueBars, ShareBars, VisitorsArea } from "@/components/pp/chart-card";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatCard } from "@/components/pp/stat-card";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getIntegrations, getSummary } from "@/lib/api";
import { formatNumber, sourceLabel } from "@/lib/format";
import type { RangeKey } from "@/lib/types";

const LABEL: Record<RangeKey, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data: s, loading, error, reload } = useApi(() => getSummary(range), [range], { live: true });
  const integrations = useApi(getIntegrations, []);
  const busy = loading && !s;
  const funnelTop = s?.funnel[0]?.value || 1;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Built in, no setup. Connect Google Analytics or Clarity for the deep stuff."
        actions={
          <Segmented label="Date range" value={range} onChange={setRange} options={[{ value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "90d", label: "90 days" }]} />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" loading={busy} value={s && <MoneyText value={s.revenue} />} delta={s?.deltas.revenue} emphasis />
        <StatCard label="Sales" loading={busy} value={s && formatNumber(s.sales)} delta={s?.deltas.sales} />
        <StatCard label="Visitors" loading={busy} value={s && formatNumber(s.visitors)} delta={s?.deltas.visitors} />
        <StatCard label="Conversion" loading={busy} value={s && `${s.conversion.toFixed(2)}%`} delta={s?.deltas.conversion} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue" description={LABEL[range]} loading={busy} error={error} onRetry={reload} empty={s?.revenue.amount === 0} emptyText="No sales in this range.">
          {s && <RevenueBars data={s.series} />}
        </ChartCard>
        <ChartCard title="Visitors" description={LABEL[range]} loading={busy} error={error} onRetry={reload} empty={s?.visitors === 0}>
          {s && <VisitorsArea data={s.series} />}
        </ChartCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Top products" className="lg:col-span-2" loading={busy} error={error} onRetry={reload} height={200} empty={s?.topProducts.length === 0} emptyText="Sell something and it'll rank here.">
          <table className="w-full text-sm" aria-label="Top products">
            <thead>
              <tr className="eyebrow text-left">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 text-right font-medium">Sales</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {s?.topProducts.map((p) => (
                <tr key={p.productId}>
                  <td className="py-2.5 pr-3"><Link href={`/products/${p.productId}`} className="inline-flex pointer-coarse:min-h-11 items-center font-medium hover:underline">{p.title}</Link></td>
                  <td className="py-2.5 text-right font-mono text-[0.8125rem]">{p.sales}</td>
                  <td className="py-2.5 text-right"><MoneyText value={p.revenue} mono /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
        <ChartCard title="Sources" description="Where paying visitors came from" loading={busy} error={error} onRetry={reload} height={200} empty={s?.sources.length === 0}>
          {s && <ShareBars rows={s.sources.map((x) => ({ label: sourceLabel(x.source), value: x.visitors, share: x.share }))} />}
        </ChartCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Funnel" description="Visit to payment" className="lg:col-span-2" loading={busy} error={error} onRetry={reload} height={180}>
          {s && <ShareBars rows={s.funnel.map((f) => ({ label: f.label, value: f.value, share: (f.value / funnelTop) * 100 }))} />}
        </ChartCard>
        <section aria-labelledby="int-h" className="flex flex-col gap-3 rounded-card border bg-surface p-5 md:p-6">
          <h2 id="int-h" className="font-display text-lg">Deeper tracking</h2>
          {integrations.data?.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{i.name}</span>
              <StatusPill status={i.connected ? "connected" : "not_connected"} />
            </div>
          ))}
          <Link href="/integrations" className="mt-auto inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <Plug className="size-4" aria-hidden /> Manage integrations
          </Link>
        </section>
      </div>
    </>
  );
}
