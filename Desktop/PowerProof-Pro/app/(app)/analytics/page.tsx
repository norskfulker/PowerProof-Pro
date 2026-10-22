"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarRange, Download, FileText, Printer } from "lucide-react";
import { GoalCard } from "@/components/analytics/goal-card";
import { downloadCsv } from "@/components/pp/data-table";
import type { CsvValue } from "@/lib/csv";
import { ProductPerformance } from "@/components/products/product-performance";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChartCard, ShareBars, TrendChart } from "@/components/pp/chart-card";
import { ErrorState } from "@/components/pp/empty-state";
import { SubmissionsCard } from "@/components/leads/form-responses";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { Segmented } from "@/components/pp/segmented";
import { NoData, StatCard } from "@/components/pp/stat-card";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getAnalyticsDetail, getLeads, getSummary } from "@/lib/api";
import { countryByCode, flagOf } from "@/lib/countries";
import { formatNumber, sourceLabel } from "@/lib/format";
import { csvAmount, formatMoney, money } from "@/lib/money";
import type { Compare, Period, RangeKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sellsKind } from "@/lib/shipping";

type RangeChoice = RangeKey | "custom";
const RANGES: { value: RangeChoice; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];
const DELTA_HINT: Record<RangeKey, string> = { today: "vs yesterday", "7d": "vs last week", "30d": "vs last month", "90d": "vs prior 90 days" };
const RANGE_TEXT: Record<RangeKey, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };
const COMPARES: { value: Compare; label: string }[] = [
  { value: "previous", label: "Vs. period before" },
  { value: "year", label: "Vs. a year earlier" },
  { value: "none", label: "No comparison" },
];
/** "1 Oct – 7 Oct" for IST days */
const dayText = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const periodText = (p: Period) => (p.from === p.to ? dayText(p.from) : `${dayText(p.from)} – ${dayText(p.to)}`);
const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const SOURCES = ["Direct", "Search", "Social", "Email", "Other"];
const FUNNEL = ["Visits", "Viewed a product", "Started checkout", "Paid"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

/** Pick any start and end day */
function CustomRange({ value, active, onApply }: { value: Period; active: boolean; onApply: (p: Period) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const max = istToday();
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setFrom(value.from); setTo(value.to); } }}>
      <PopoverTrigger asChild>
        <Button variant={active ? "primary" : "secondary"} aria-pressed={active}><CalendarRange aria-hidden /> {active ? periodText(value) : "Custom"}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!from || !to) return;
            onApply(from <= to ? { from, to } : { from: to, to: from });
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="range-from">From</Label><Input id="range-from" type="date" max={max} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="range-to">To</Label><Input id="range-to" type="date" max={max} value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <Button type="submit" disabled={!from || !to}>Show these days</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Paid orders by weekday and hour (India time): the darker, the busier */
function Heatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-0.5 text-xs" aria-label="Orders by day and hour">
        <thead>
          <tr>
            <th className="w-10" />
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} scope="col" className="font-mono font-normal text-muted-foreground">{h % 3 === 0 ? h : ""}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heat.map((row, d) => (
            <tr key={d}>
              <th scope="row" className="pr-2 text-left font-medium text-muted-foreground">{DAYS[d]}</th>
              {row.map((n, h) => (
                <td key={h} title={`${DAYS[d]} ${h}:00 · ${n} order${n === 1 ? "" : "s"}`} className={cn("h-5 rounded-[3px]", n ? "bg-primary" : "bg-muted")} style={n ? { opacity: 0.2 + 0.8 * (n / max) } : undefined}>
                  <span className="sr-only">{n}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Analytics, in detail: sales and refunds, buyers (new and returning, where they are), products,
 * when people buy, checkout drop-off and recovered carts, payments, discounts, shipping, visitors
 * and the store's forms. The dashboard keeps only today's glance.
 */
export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeChoice>("30d");
  const [custom, setCustom] = useState<Period>(() => { const t = istToday(); return { from: `${t.slice(0, 7)}-01`, to: t }; });
  const [compare, setCompare] = useState<Compare>("previous");
  const [drill, setDrill] = useState<{ id: string; title: string } | null>(null);
  const store = useCurrentStore();
  const q: RangeKey | Period = range === "custom" ? custom : range;
  const key = range === "custom" ? `${custom.from}:${custom.to}` : range;
  const summary = useApi(() => getSummary(q, compare), [key, compare], { live: true });
  const detail = useApi(() => getAnalyticsDetail(q), [key], { live: true });
  const leads = useApi(getLeads, [], { live: true });

  const d = detail.data;
  const s = summary.data;
  const m = (n: number) => (d ? money(n, d.currency) : undefined);
  const loading = detail.loading && !d;
  const physical = sellsKind(store.data?.sells, "physical");
  const label = s ? periodText(s.period) : range === "custom" ? periodText(custom) : RANGE_TEXT[range];
  const hint = compare === "none" ? undefined : compare === "year" ? "vs a year earlier" : range === "custom" ? "vs the days before" : DELTA_HINT[range];
  const compareName = compare === "year" ? "a year earlier" : "period before";
  const since = s ? Date.parse(`${s.period.from}T00:00:00Z`) - 5.5 * 3_600_000 : 0;
  // The period's numbers for an accountant or the team
  const exportSummary = () =>
    s && d && downloadCsv(
      [
        ["Period", label],
        ["Revenue", csvAmount(s.revenue)],
        ["Orders", s.sales],
        ["Net sales", csvAmount(m(d.net))],
        ["Average order", csvAmount(m(d.aov))],
        ["Refunds", csvAmount(m(d.refunds))],
        ["Buyers", d.buyers],
        ["Currency", d.currency],
        ["Visitors", s.visitors],
        ["Conversion %", s.conversion == null ? "" : s.conversion.toFixed(2)],
      ],
      [{ header: "Measure", value: (r: CsvValue[]) => r[0] }, { header: "Value", value: (r: CsvValue[]) => r[1] }],
      "analytics-summary"
    );
  return (
    <>
      <PageHeader
        title="Analytics"
        actions={
          <>
            <Segmented label="Date range" value={range === "custom" ? ("" as RangeChoice) : range} onChange={setRange} options={RANGES} />
            <CustomRange value={custom} active={range === "custom"} onApply={(p) => { setCustom(p); setRange("custom"); }} />
            <Select value={compare} onValueChange={(v) => setCompare(v as Compare)}>
              <SelectTrigger className="w-44" aria-label="Compare with"><SelectValue /></SelectTrigger>
              <SelectContent>{COMPARES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" disabled={!s || !d}><Download aria-hidden /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={exportSummary}><FileText aria-hidden /> Summary (CSV)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => s && downloadCsv(s.series, [{ header: "Day", value: (p) => p.label }, { header: "Revenue", value: (p) => p.revenue.toFixed(2) }, { header: "Orders", value: (p) => p.orders }, { header: "Visitors", value: (p) => p.visitors ?? "" }, ...(s.comparedWith ? [{ header: `Revenue (${compareName})`, value: (p: (typeof s.series)[number]) => p.prevRevenue?.toFixed(2) ?? "" }, { header: `Orders (${compareName})`, value: (p: (typeof s.series)[number]) => p.prevOrders ?? "" }] : [])], "analytics-daily")}><FileText aria-hidden /> Day by day (CSV)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => d && downloadCsv(d.products, [{ header: "Product", value: (p) => p.title }, { header: "Units", value: (p) => p.units }, { header: "Orders", value: (p) => p.orders }, { header: "Revenue", value: (p) => csvAmount(m(p.revenue)) }, { header: "Share %", value: (p) => p.share.toFixed(1) }], "analytics-products")}><FileText aria-hidden /> Products (CSV)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => window.print()}><Printer aria-hidden /> Print or save as PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <style>{`@media print{header,nav,aside,[data-print-hide]{display:none!important}main{padding:0!important}}`}</style>
      <p className="-mt-4 mb-4 hidden text-sm text-muted-foreground print:block">{label}{s?.comparedWith ? `, compared with ${periodText(s.comparedWith)}` : ""}</p>
      <GoalCard className="mb-6" />

      <div className="flex flex-col gap-6">
        <section aria-label="Sales" className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <StatCard label="Revenue" value={s && <MoneyText value={s.revenue} />} delta={s?.deltas.revenue} hint={s ? hint : undefined} loading={!s} />
          <StatCard label="Sales" value={s && formatNumber(s.sales)} delta={s?.deltas.sales} hint={s ? hint : undefined} loading={!s} />
          <StatCard label="Visitors" value={s && (s.visitors == null ? <NoData /> : formatNumber(s.visitors))} delta={s?.deltas.visitors} hint={s ? hint : undefined} loading={!s} />
          <StatCard label="Conversion" value={s && (s.conversion == null ? <NoData /> : `${s.conversion.toFixed(1)}%`)} delta={s?.deltas.conversion} hint="Visitors who paid" loading={!s} />
          <StatCard label="Net sales" value={d && <MoneyText value={m(d.net)!} />} hint={d && d.refunds > 0 ? `${formatMoney(m(d.gross)!)} before refunds` : "After refunds"} loading={loading} emphasis />
          <StatCard label="Average order" value={d && <MoneyText value={m(d.aov)!} />} hint={d ? `${formatNumber(d.orders)} orders` : undefined} loading={loading} />
          <StatCard label="Buyers" value={d && formatNumber(d.buyers)} hint={d && d.buyers ? `${pct(d.returning, d.buyers).toFixed(0)}% bought before` : "New and returning"} loading={loading} />
          <StatCard label="Refunds" value={d && <MoneyText value={m(d.refunds)!} />} hint={d ? `${formatNumber(d.refundCount)} order${d.refundCount === 1 ? "" : "s"} · ${pct(d.refundCount, d.orders).toFixed(1)}%` : undefined} loading={loading} />
        </section>
        {summary.error && <ErrorState message={summary.error} onRetry={summary.reload} />}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ChartCard title="Revenue" description={label} loading={summary.loading && !summary.data} error={summary.error} onRetry={summary.reload} empty={!summary.data?.series.some((p) => p.revenue > 0)} emptyText="No sales in this period" emptyChart={<TrendChart name="revenue" tone="revenue" kind="money" data={(summary.data?.series ?? []).map((p) => ({ label: p.label, value: 0 }))} />}>
            {summary.data && <TrendChart name="revenue" tone="revenue" kind="money" currency={summary.data.revenue.currency} compareName={compareName} data={summary.data.series.map((p) => ({ label: p.label, value: p.revenue, compare: p.prevRevenue }))} />}
          </ChartCard>
          <ChartCard title="Orders" description={label} loading={summary.loading && !summary.data} error={summary.error} onRetry={summary.reload} empty={!summary.data?.series.some((p) => p.orders > 0)} emptyText="No orders in this period" emptyChart={<TrendChart name="orders" tone="orders" variant="line" data={(summary.data?.series ?? []).map((p) => ({ label: p.label, value: 0 }))} />}>
            {summary.data && <TrendChart name="orders" tone="orders" variant="line" compareName={compareName} data={summary.data.series.map((p) => ({ label: p.label, value: p.orders, compare: p.prevOrders }))} />}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <ChartCard title="Products" description="What sold in this period. Pick one to see its numbers." height={220} loading={loading} error={detail.error} onRetry={detail.reload} empty={!d?.products.length} emptyText="No sales in this period">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="pb-2 font-medium">Product</th><th className="pb-2 text-right font-medium">Units</th><th className="pb-2 text-right font-medium">Orders</th><th className="pb-2 text-right font-medium">Revenue</th><th className="pb-2 text-right font-medium">Share</th></tr>
                </thead>
                <tbody>
                  {d?.products.map((p) => (
                    <tr key={p.productId ?? p.title} className="border-t">
                      <td className="max-w-56 truncate py-2 font-medium">{p.productId ? <button type="button" className="max-w-full truncate text-left hover:underline" onClick={() => setDrill({ id: p.productId!, title: p.title })}>{p.title}</button> : p.title}</td>
                      <td className="py-2 text-right font-mono">{formatNumber(p.units)}</td>
                      <td className="py-2 text-right font-mono">{formatNumber(p.orders)}</td>
                      <td className="py-2 text-right"><MoneyText value={m(p.revenue)!} mono /></td>
                      <td className="py-2 text-right font-mono text-muted-foreground">{p.share.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
          <ChartCard title="Checkout" description="Started, left and won back" height={220} loading={loading} error={detail.error} onRetry={detail.reload} empty={!d?.checkout.started} emptyText="No checkouts in this period">
            {d && (
              <div className="flex flex-col gap-4">
                <ShareBars
                  rows={[
                    { label: "Started checkout", value: d.checkout.started, share: 100 },
                    { label: "Paid or placed", value: d.checkout.paid, share: pct(d.checkout.paid, d.checkout.started) },
                    { label: "Left without paying", value: d.checkout.abandoned, share: pct(d.checkout.abandoned, d.checkout.started) },
                  ]}
                />
                <dl className="grid grid-cols-3 gap-3 border-t pt-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Left behind</dt><dd className="font-semibold"><MoneyText value={m(d.checkout.abandonedValue)!} /></dd></div>
                  <div><dt className="text-xs text-muted-foreground">Reminded</dt><dd className="font-semibold">{formatNumber(d.checkout.reminded)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Won back</dt><dd className="font-semibold">{formatNumber(d.checkout.recovered)} · <MoneyText value={m(d.checkout.recoveredValue)!} /></dd></div>
                </dl>
                {store.data && !store.data.cartReminders && (
                  <p className="text-xs text-muted-foreground">Reminder emails are off. <Link href="/settings/profile#notifications" className="font-medium text-primary underline underline-offset-4">Turn them on</Link> to win back more.</p>
                )}
              </div>
            )}
          </ChartCard>
        </div>

        <ChartCard title="When people buy" description="Paid orders by day and hour, India time" height={200} loading={loading} error={detail.error} onRetry={detail.reload} empty={!d?.orders} emptyText="No sales in this period">
          {d && <Heatmap heat={d.heat} />}
        </ChartCard>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ChartCard title="Buyers by country" height={180} loading={loading} empty={!d?.countries.length} emptyText="No sales in this period">
            <ShareBars rows={(d?.countries ?? []).map((c) => ({ label: `${flagOf(c.key)} ${countryByCode(c.key).name}`, value: c.revenue, share: c.share }))} format={(n) => formatMoney(m(n)!)} />
          </ChartCard>
          <ChartCard title="Buyers in India, by state" height={180} loading={loading} empty={!d?.states.length} emptyText="No sales in India in this period">
            <ShareBars rows={(d?.states ?? []).map((s) => ({ label: s.key, value: s.revenue, share: s.share }))} format={(n) => formatMoney(m(n)!)} />
          </ChartCard>
          <ChartCard title="Where buyers come from" height={180} loading={summary.loading && !summary.data} empty={!summary.data?.sources.length} emptyText="No visits recorded yet" emptyChart={<ShareBars rows={SOURCES.map((label) => ({ label, value: 0, share: 0 }))} />}>
            <ShareBars rows={(summary.data?.sources ?? []).map((s) => ({ label: sourceLabel(s.source), value: s.visitors, share: s.share }))} />
          </ChartCard>
          <ChartCard title="Store funnel" description="Visit to payment" height={180} loading={summary.loading && !summary.data} empty={!summary.data?.funnel[0]?.value} emptyText="No visits recorded yet" emptyChart={<ShareBars rows={FUNNEL.map((label) => ({ label, value: 0, share: 0 }))} />}>
            <ShareBars rows={(summary.data?.funnel ?? []).map((f) => ({ label: f.label, value: f.value, share: pct(f.value, summary.data!.funnel[0].value) }))} />
          </ChartCard>
          <ChartCard title="Visitors" height={180} loading={summary.loading && !summary.data} empty={!summary.data?.visitors} emptyText="No visits recorded yet" emptyChart={<TrendChart name="visitors" tone="visitors" height={180} data={(summary.data?.series ?? []).map((p) => ({ label: p.label, value: 0 }))} />}>
            <TrendChart name="visitors" tone="visitors" height={180} compareName={compareName} data={(summary.data?.series ?? []).map((p) => ({ label: p.label, value: p.visitors ?? 0, compare: p.prevVisitors }))} />
          </ChartCard>
          <ChartCard title="Payments and discounts" height={180} loading={loading} empty={!d?.payments.length} emptyText="No sales in this period">
            {d && (
              <div className="flex flex-col gap-4">
                <ShareBars rows={d.payments.map((p) => ({ label: p.key, value: p.orders, share: p.share }))} format={(n) => `${formatNumber(n)} orders`} />
                <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Orders with a discount</dt><dd className="font-semibold">{formatNumber(d.discountOrders)} · {pct(d.discountOrders, d.orders).toFixed(0)}%</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Discounts given</dt><dd className="font-semibold"><MoneyText value={m(d.discountGiven)!} /></dd></div>
                </dl>
              </div>
            )}
          </ChartCard>
        </div>

        {physical && (
          <section aria-label="Shipping" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="To ship" value={d && formatNumber(d.shipping.toShip)} hint={d && d.shipping.toShip > 0 ? <Link href="/sales/orders" className="underline">See orders</Link> : "All sent"} loading={loading} />
            <StatCard label="On the way" value={d && formatNumber(d.shipping.shipped)} loading={loading} />
            <StatCard label="Delivered" value={d && formatNumber(d.shipping.delivered)} loading={loading} />
            <StatCard label="Time to ship" value={d && (d.shipping.avgHoursToShip == null ? "—" : d.shipping.avgHoursToShip < 48 ? `${d.shipping.avgHoursToShip.toFixed(0)} h` : `${(d.shipping.avgHoursToShip / 24).toFixed(1)} days`)} hint="From paid to shipped, on average" loading={loading} />
            <StatCard label="Cash to collect" value={d && <MoneyText value={m(d.codPending)!} />} hint={d ? `${formatNumber(d.codPendingCount)} cash-on-delivery order${d.codPendingCount === 1 ? "" : "s"}` : undefined} loading={loading} />
          </section>
        )}

        <SubmissionsCard leads={leads.data} since={since} loading={leads.loading} />
      </div>

      <Sheet open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{drill?.title}</SheetTitle>
            <SheetDescription>{label}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            {drill && s && d && (
              <ProductPerformance
                product={{ id: drill.id, price: money(0, d.currency) }}
                range={{ from: new Date(Date.parse(`${s.period.from}T00:00:00Z`) - 5.5 * 3_600_000), to: new Date(Date.parse(`${s.period.to}T00:00:00Z`) + 18.5 * 3_600_000) }}
                className="border-0 p-0"
              />
            )}
            {drill && <Button asChild variant="secondary" className="self-start"><Link href={`/catalog/products/${drill.id}`}>Open the product</Link></Button>}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
