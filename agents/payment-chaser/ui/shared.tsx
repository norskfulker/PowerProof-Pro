"use client";

import { useMemo } from "react";
import { useApi } from "@/hooks/use-api";
import { getChaserData, type ChaserCustomer, type ChaserInvoice } from "@/lib/api/agents";
import { istDay } from "@/lib/agents/time";
import { formatDayIN } from "@/lib/agents/time";
import { formatMoney } from "@/lib/money";
import { AGING, overdue, type StatInvoice } from "../lib/stats";

/** Shared bits for Payment Chaser's screens */

export const inr = (minor: number, whole = true) => {
  const s = formatMoney({ amount: minor, currency: "INR" });
  return whole ? s.replace(/\.00$/, "") : s;
};
export const day = (d: string) => formatDayIN(d);

export const statInvoice = (i: ChaserInvoice): StatInvoice => ({ id: i.id, status: i.status, dueDate: i.dueDate, totalMinor: i.totalMinor, paidMinor: i.paidMinor, paidAt: i.paidAt });

export interface CustomerSummary {
  customer: ChaserCustomer;
  owedMinor: number;
  overdueMinor: number;
  oldestDue: string | null;
  openCount: number;
}

/** Customers and invoices for the active store, with the numbers screens need */
export function useChaser() {
  const api = useApi(getChaserData, [], { live: true });
  const derived = useMemo(() => {
    const d = api.data;
    if (!d) return null;
    const today = istDay(new Date());
    const due = overdue(d.invoices.map(statInvoice), today);
    const byCustomer = new Map<string, CustomerSummary>(d.customers.map((c) => [c.id, { customer: c, owedMinor: 0, overdueMinor: 0, oldestDue: null, openCount: 0 }]));
    for (const i of d.invoices) {
      if (i.status !== "open") continue;
      const s = byCustomer.get(i.customerId);
      if (!s) continue;
      const left = i.totalMinor - i.paidMinor;
      s.owedMinor += left;
      s.openCount++;
      if (i.dueDate < today) {
        s.overdueMinor += left;
        if (!s.oldestDue || i.dueDate < s.oldestDue) s.oldestDue = i.dueDate;
      }
    }
    return { today, due, customers: [...byCustomer.values()], invoices: d.invoices, customerById: new Map(d.customers.map((c) => [c.id, c])) };
  }, [api.data]);
  return { ...api, derived };
}

const AGING_COLOURS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

/** Where the overdue money sits by age: one bar, four parts, labelled underneath */
export function AgingBar({ buckets }: { buckets: { key: string; label: string; count: number; minor: number }[] }) {
  const total = buckets.reduce((n, b) => n + b.minor, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={buckets.map((b) => `${b.label}: ${inr(b.minor)}`).join(", ")}>
        {total > 0 && buckets.map((b, i) => (b.minor > 0 ? <span key={b.key} style={{ width: `${(b.minor / total) * 100}%`, background: AGING_COLOURS[i] }} /> : null))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {buckets.map((b, i) => (
          <li key={b.key} className="flex items-start gap-2">
            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: AGING_COLOURS[i] }} aria-hidden />
            <span>
              <span className="block text-muted-foreground">{b.label}</span>
              <span className="font-semibold tabular">{inr(b.minor)}</span> <span className="text-muted-foreground">({b.count})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { AGING };
