"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, Banknote, ChevronRight, Flag, ShieldCheck, Webhook } from "lucide-react";
import { ChartCard, VisitorsArea } from "@/components/pp/chart-card";
import { ErrorState } from "@/components/pp/empty-state";
import { MoneyList } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { Segmented } from "@/components/pp/segmented";
import { StatCard } from "@/components/pp/stat-card";
import { useApi } from "@/hooks/use-api";
import { getAdminLive, getAdminOverview, RANGES, type AdminOverview, type Cohort, type Range } from "@/lib/api";
import { formatNumber } from "@/lib/format";

const LIVE_EVERY_MS = 15_000;
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
/** Percent change against the stretch of time just before; nothing to compare with gives no figure */
const change = (now: number, before: number): number | null => (before > 0 ? ((now - before) / before) * 100 : null);

function LiveStrip() {
  const { data, error } = useApi(() => getAdminLive(), []);
  const [live, setLive] = useState<typeof data>();
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const tick = () => getAdminLive().then((d) => (setLive(d), setStale(false)), () => setStale(true));
    const t = setInterval(tick, LIVE_EVERY_MS);
    return () => clearInterval(t);
  }, []);
  const v = live ?? data;
  const items = [
    { label: "Creators online", n: v?.creators },
    { label: "Visitors on stores", n: v?.visitors },
    { label: "Payments in the last hour", n: v?.payments },
  ];
  return (
    <section aria-label="Online now" className="rounded-card border bg-surface p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex size-2.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
          <span className={stale || error ? "relative inline-flex size-2.5 rounded-full bg-danger" : "relative inline-flex size-2.5 rounded-full bg-success"} />
        </span>
        <h2 className="font-display text-lg">Online now</h2>
        <span className="text-sm text-muted-foreground">{stale || error ? "Can't refresh. Showing the last count." : "Active in the last 5 minutes. Refreshes every 15 seconds."}</span>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {items.map((i) => (
          <div key={i.label} className="rounded-control bg-surface-sunken px-4 py-3">
            <dd className="font-display text-2xl font-extrabold tabular md:text-3xl">{i.n == null ? "—" : formatNumber(i.n)}</dd>
            <dt className="text-xs text-muted-foreground md:text-sm">{i.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ActivityTable({ o }: { o: AdminOverview }) {
  const rows: { label: string; hint: string; c: Cohort }[] = [
    { label: "Creators", hint: "Opened the app", c: o.activity.creators },
    { label: "Store visitors", hint: "Browser sessions on storefronts", c: o.activity.visitors },
    { label: "Buyers", hint: "Paid for something", c: o.activity.buyers },
  ];
  return (
    <section aria-label="Active users" className="rounded-card border bg-surface p-5 md:p-6">
      <h2 className="font-display text-lg">Active users</h2>
      <p className="text-sm text-muted-foreground">Daily, monthly and yearly. Today and the last 30 and 365 days, in India time.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase">
              <th scope="col" className="py-2 pr-4 font-semibold">Who</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">DAU</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">MAU</th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">YAU</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="py-3 pr-4 text-left font-medium">
                  {r.label}
                  <span className="block text-xs font-normal text-muted-foreground">{r.hint}</span>
                </th>
                <td className="px-3 py-3 text-right font-mono tabular">{formatNumber(r.c.dau)}</td>
                <td className="px-3 py-3 text-right font-mono tabular">{formatNumber(r.c.mau)}</td>
                <td className="py-3 pl-3 text-right font-mono tabular">{formatNumber(r.c.yau)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Store visitors are counted by browser session, so one person on two devices counts twice. Creator counts begin from the day this was switched on.</p>
    </section>
  );
}

export default function Page() {
  const [range, setRange] = useState<Range>(30);
  const { data: o, loading, error, reload } = useApi(() => getAdminOverview(range), [range], { live: true });
  const busy = loading && !o;
  const vs = `vs the ${range} days before`;

  const queues = o
    ? [
        { href: "/admin/money/payouts", icon: Banknote, label: "Payouts to send", n: o.queues.payouts },
        { href: "/admin/orders/disputed", icon: AlertOctagon, label: "Open disputes", n: o.queues.disputes },
        { href: "/admin/moderation/flags", icon: Flag, label: "Reports to review", n: o.queues.reports },
        { href: "/admin/moderation/deals", icon: ShieldCheck, label: "Deals to verify", n: o.queues.deals },
        { href: "/admin/system/webhooks", icon: Webhook, label: "Failed webhooks (7 days)", n: o.queues.webhookFailures },
      ]
    : [];

  const chart = (key: "payments" | "signups" | "activeCreators" | "visitors", name: string, title: string, description: string, none: string) => (
    <ChartCard title={title} description={description} height={200} loading={busy} empty={!o?.series.some((d) => d[key])} emptyText={none} emptyChart={<VisitorsArea height={200} name={name} data={(o?.series ?? []).map((d) => ({ label: shortDay(d.day), visitors: 0 }))} />}>
      <VisitorsArea height={200} name={name} data={(o?.series ?? []).map((d) => ({ label: shortDay(d.day), visitors: d[key] }))} />
    </ChartCard>
  );

  return (
    <>
      <title>Overview · PowerProof admin</title>
      <PageHeader
        title="Overview"
        description="How the platform is doing, and what needs a person."
        actions={<Segmented label="Time range" value={`${range}d`} onChange={(v) => setRange(Number.parseInt(v, 10) as Range)} options={RANGES.map((r) => ({ value: `${r}d`, label: `${r} days` }))} />}
      />
      {error && !o ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="flex flex-col gap-6">
          <LiveStrip />

          <section aria-label={`Last ${range} days`}>
            <h2 className="mb-3 font-display text-lg">Last {range} days</h2>
            <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3">
              <StatCard label="Payments" loading={busy} value={o && formatNumber(o.period.payments)} delta={o ? change(o.period.payments, o.before.payments) : null} hint={o && `${vs}${o.period.refunds ? ` · ${o.period.refunds} refunded` : ""}`} />
              <StatCard label="Payment volume" loading={busy} value={o && <MoneyList values={o.period.gmv.map((g) => ({ amount: g.amount, currency: g.currency }))} />} hint="What buyers paid, per currency" />
              <StatCard label="Platform fees" emphasis loading={busy} value={o && <MoneyList values={o.period.fees.map((f) => ({ amount: f.amount, currency: f.currency }))} />} hint="Our cut of those sales" />
              <StatCard label="New creators" loading={busy} value={o && formatNumber(o.period.signups)} delta={o ? change(o.period.signups, o.before.signups) : null} hint={o && `${vs} · ${o.period.newStores} new stores`} />
              <StatCard label="Active creators" loading={busy} value={o && formatNumber(o.period.activeCreators)} delta={o ? change(o.period.activeCreators, o.before.activeCreators) : null} hint={vs} />
              <StatCard label="Store visitors" loading={busy} value={o && formatNumber(o.period.visitors)} delta={o ? change(o.period.visitors, o.before.visitors) : null} hint={o && `${vs} · ${formatNumber(o.period.buyers)} buyers`} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {chart("payments", "payments", "Payments", `Per day, last ${range} days`, "No payments yet")}
            {chart("signups", "creators", "New creators", `Per day, last ${range} days`, "No sign-ups yet")}
            {chart("activeCreators", "creators", "Active creators", `Opened the app, per day`, "No activity recorded yet")}
            {chart("visitors", "visitors", "Store visitors", `Browser sessions, per day`, "No visits recorded yet")}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">{o && <ActivityTable o={o} />}
            <section aria-label="Everything so far" className="rounded-card border bg-surface p-5 md:p-6">
              <h2 className="font-display text-lg">Everything so far</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {(o
                  ? [
                      ["Creators", `${formatNumber(o.totals.creators)} (${formatNumber(o.totals.pro)} on Pro)`],
                      ["Stores", `${formatNumber(o.totals.storesLive)} live of ${formatNumber(o.totals.stores)}${o.totals.storesSuspended ? ` · ${o.totals.storesSuspended} suspended` : ""}`],
                      ["Products", `${formatNumber(o.totals.productsLive)} live of ${formatNumber(o.totals.products)}`],
                      ["Buyers", formatNumber(o.totals.buyers)],
                      ["Paid orders", `${formatNumber(o.totals.paidOrders)} · ${formatNumber(o.totals.refunded)} refunded`],
                    ]
                  : []
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Total payment volume</dt>
                  <dd className="font-medium">{o && <MoneyList values={o.totals.gmv.map((g) => ({ amount: g.amount, currency: g.currency }))} />}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Total platform fees</dt>
                  <dd className="font-medium">{o && <MoneyList values={o.totals.fees.map((g) => ({ amount: g.amount, currency: g.currency }))} />}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section aria-label="Needs attention">
            <h2 className="mb-3 font-display text-lg">Needs a person</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {(busy ? [] : queues).map((q) => (
                <li key={q.href}>
                  <Link href={q.href} className="flex min-h-16 items-center gap-3 rounded-card border bg-surface px-4 py-3 hover:bg-surface-sunken">
                    <span className={q.n ? "grid size-10 shrink-0 place-items-center rounded-full bg-warning-soft text-warning-ink" : "grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"}>
                      <q.icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-2xl leading-none font-extrabold tabular">{formatNumber(q.n)}</span>
                      <span className="block text-sm text-muted-foreground">{q.label}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
