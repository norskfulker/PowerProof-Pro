import { money } from "../money";
import { db } from "../mock/db";
import { DAY } from "../mock/random";
import type { Order, RangeKey, SeriesPoint, Summary, TrafficSource } from "../types";
import { call } from "./client";

const RANGE_DAYS: Record<RangeKey, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

const counted = (o: Order) => o.status === "paid" || o.status === "refund_requested";

/** Deterministic, believable visitor count for a time bucket. */
function visitorsFor(seed: number, orders: number, fresh: boolean): number {
  if (fresh) return orders * 18 + (seed % 7);
  const base = 40 + ((seed * 9301 + 49297) % 233280) / 233280 * 70;
  return Math.round(base + orders * 52);
}

function startOfToday(now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function buildSummary(range: RangeKey, now = Date.now()): Summary {
  const d = db();
  const fresh = d.mode === "fresh";
  const days = RANGE_DAYS[range];
  const start = range === "today" ? startOfToday(now) : now - days * DAY;
  const prevStart = start - (now - start);
  const inRange = d.orders.filter((o) => counted(o) && Date.parse(o.createdAt) >= start);
  const prev = d.orders.filter((o) => counted(o) && Date.parse(o.createdAt) >= prevStart && Date.parse(o.createdAt) < start);

  /* Series buckets */
  const series: SeriesPoint[] = [];
  const bucketCount = range === "today" ? 12 : range === "7d" ? 7 : range === "30d" ? 15 : 13;
  const span = (now - start) / bucketCount;
  for (let i = 0; i < bucketCount; i++) {
    const a = start + i * span;
    const b = a + span;
    const os = inRange.filter((o) => {
      const t = Date.parse(o.createdAt);
      return t >= a && t < b;
    });
    const dt = new Date(a);
    const label =
      range === "today"
        ? dt.toLocaleTimeString("en-IN", { hour: "numeric" })
        : range === "7d"
          ? dt.toLocaleDateString("en-IN", { weekday: "short" })
          : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    series.push({
      label,
      revenue: os.reduce((t, o) => t + o.total.amount, 0) / 100,
      orders: os.length,
      visitors: visitorsFor(Math.floor(a / 3600000), os.length, fresh) * (range === "today" ? 1 : range === "90d" ? 7 : range === "30d" ? 2 : 1),
    });
  }

  const visitors = series.reduce((t, s) => t + s.visitors, 0);
  const revenue = inRange.reduce((t, o) => t + o.total.amount, 0);
  const prevRevenue = prev.reduce((t, o) => t + o.total.amount, 0);
  const conversion = visitors ? (inRange.length / visitors) * 100 : 0;
  const pct = (a: number, b: number, fallback: number) => (b ? ((a - b) / b) * 100 : a ? fallback : 0);

  /* Top products */
  const byProduct = new Map<string, { title: string; sales: number; revenue: number }>();
  for (const o of inRange) {
    const cur = byProduct.get(o.productId) ?? { title: o.productTitle, sales: 0, revenue: 0 };
    cur.sales += 1;
    cur.revenue += o.total.amount;
    byProduct.set(o.productId, cur);
  }
  const topProducts = [...byProduct.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([productId, v]) => ({ productId, title: v.title, sales: v.sales, revenue: money(v.revenue) }));

  /* Sources */
  const srcCount = new Map<TrafficSource, number>();
  for (const o of inRange) srcCount.set(o.source, (srcCount.get(o.source) ?? 0) + 1);
  const totalSrc = [...srcCount.values()].reduce((t, n) => t + n, 0) || 1;
  const sources = [...srcCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, n]) => ({ source, visitors: Math.round((n / totalSrc) * visitors), share: (n / totalSrc) * 100 }));

  const productViews = Math.round(visitors * 0.48);
  const checkouts = Math.max(inRange.length, Math.round(visitors * 0.07));

  return {
    range,
    revenue: money(revenue),
    sales: inRange.length,
    visitors,
    conversion,
    deltas: {
      revenue: pct(revenue, prevRevenue, 100),
      sales: pct(inRange.length, prev.length, 100),
      visitors: fresh ? 0 : 9.4,
      conversion: fresh ? 0 : 0.3,
    },
    series,
    topProducts,
    sources,
    funnel: [
      { label: "Visited store", value: visitors },
      { label: "Viewed a product", value: productViews },
      { label: "Started checkout", value: checkouts },
      { label: "Paid", value: inRange.length },
    ],
  };
}

export function getSummary(range: RangeKey): Promise<Summary> {
  return call(() => buildSummary(range));
}
