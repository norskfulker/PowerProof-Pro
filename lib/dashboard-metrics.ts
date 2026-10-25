/**
 * The dashboard's Sales, Visitors and Payments tabs over 1, 7 or 30 days. Pure: given the raw rows
 * for this period and the one before it, works out the totals, the change and the chart buckets
 * (hourly for 1D, one per India day for 7D and 30D). Nothing is estimated: a bucket with no rows is 0.
 */

export type MetricRange = "1d" | "7d" | "30d";
export const METRIC_RANGES: { value: MetricRange; label: string; long: string }[] = [
  { value: "1d", label: "1D", long: "last 24 hours" },
  { value: "7d", label: "7D", long: "last 7 days" },
  { value: "30d", label: "30D", long: "last 30 days" },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const IST = 5.5 * HOUR;

export interface PaidRow {
  at: string;
  amountMinor: number;
}
export interface VisitRow {
  at: string;
  session: string;
}
export interface PaymentRow {
  at: string;
  kind: "succeeded" | "failed" | "abandoned" | "expired";
  amountMinor: number;
}

export interface Bucket {
  /** Start of the bucket (ms) */
  start: number;
  label: string;
  value: number;
  /** A second series where the tab has one: orders for Sales, failed attempts for Payments */
  extra?: number;
}

export interface MetricSummary {
  primary: number;
  previous: number;
  /** Percent change from the previous period; null when there was nothing to compare with */
  change: number | null;
  /** Second number under the main one */
  secondary: number;
  buckets: Bucket[];
}

/** The period's bounds: [start, end), and the same length before it */
export function periodOf(range: MetricRange, now: number) {
  if (range === "1d") {
    const end = Math.floor(now / HOUR) * HOUR + HOUR;
    return { start: end - DAY, end, prevStart: end - 2 * DAY, step: HOUR };
  }
  const days = range === "7d" ? 7 : 30;
  // India days: the bucket edges are IST midnights
  const todayStart = Math.floor((now + IST) / DAY) * DAY - IST;
  const end = todayStart + DAY;
  return { start: end - days * DAY, end, prevStart: end - 2 * days * DAY, step: DAY };
}

function emptyBuckets(range: MetricRange, now: number): Bucket[] {
  const { start, end, step } = periodOf(range, now);
  const out: Bucket[] = [];
  for (let t = start; t < end; t += step) {
    const d = new Date(t + IST);
    const label =
      range === "1d"
        ? `${String(d.getUTCHours()).padStart(2, "0")}:00`
        : d.toLocaleDateString("en-IN", range === "7d" ? { weekday: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
    out.push({ start: t, label, value: 0, extra: 0 });
  }
  return out;
}

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);
const inside = (t: number, a: number, b: number) => t >= a && t < b;

function place(buckets: Bucket[], step: number, t: number): Bucket | undefined {
  const first = buckets[0]?.start ?? 0;
  return buckets[Math.floor((t - first) / step)];
}

/** Sales: revenue (main), number of orders (second) */
export function salesSummary(rows: PaidRow[], range: MetricRange, now: number): MetricSummary {
  const { start, end, prevStart, step } = periodOf(range, now);
  const buckets = emptyBuckets(range, now);
  let primary = 0;
  let previous = 0;
  let orders = 0;
  for (const r of rows) {
    const t = Date.parse(r.at);
    if (inside(t, start, end)) {
      primary += r.amountMinor;
      orders++;
      const b = place(buckets, step, t);
      if (b) {
        b.value += r.amountMinor;
        b.extra = (b.extra ?? 0) + 1;
      }
    } else if (inside(t, prevStart, start)) previous += r.amountMinor;
  }
  return { primary, previous, change: pct(primary, previous), secondary: orders, buckets };
}

/** Visitors: distinct visitors (main), page views (second). A visitor is one browser session. */
export function visitorSummary(rows: VisitRow[], range: MetricRange, now: number): MetricSummary {
  const { start, end, prevStart, step } = periodOf(range, now);
  const buckets = emptyBuckets(range, now);
  const seen = new Set<string>();
  const before = new Set<string>();
  const perBucket = buckets.map(() => new Set<string>());
  let views = 0;
  for (const r of rows) {
    const t = Date.parse(r.at);
    if (inside(t, start, end)) {
      seen.add(r.session);
      views++;
      const i = Math.floor((t - start) / step);
      perBucket[i]?.add(r.session);
      if (buckets[i]) buckets[i].extra = (buckets[i].extra ?? 0) + 1;
    } else if (inside(t, prevStart, start)) before.add(r.session);
  }
  buckets.forEach((b, i) => (b.value = perBucket[i].size));
  return { primary: seen.size, previous: before.size, change: pct(seen.size, before.size), secondary: views, buckets };
}

/** Payments: money collected (main), success rate % of finished attempts (second); failed attempts charted beside */
export function paymentSummary(rows: PaymentRow[], range: MetricRange, now: number): MetricSummary & { succeeded: number; failed: number } {
  const { start, end, prevStart, step } = periodOf(range, now);
  const buckets = emptyBuckets(range, now);
  let primary = 0;
  let previous = 0;
  let ok = 0;
  let bad = 0;
  for (const r of rows) {
    const t = Date.parse(r.at);
    if (inside(t, start, end)) {
      const b = place(buckets, step, t);
      if (r.kind === "succeeded") {
        primary += r.amountMinor;
        ok++;
        if (b) b.value += r.amountMinor;
      } else {
        bad++;
        if (b) b.extra = (b.extra ?? 0) + 1;
      }
    } else if (inside(t, prevStart, start) && r.kind === "succeeded") previous += r.amountMinor;
  }
  const rate = ok + bad ? Math.round((ok / (ok + bad)) * 100) : 0;
  return { primary, previous, change: pct(primary, previous), secondary: rate, buckets, succeeded: ok, failed: bad };
}
