import { analyze, type AnalyticsDetail, type ItemRow } from "../analytics-detail";
import { money } from "../money";
import { sb } from "../supabase/browser";
import type { Compare, CurrencyCode, Money, Period, RangeKey, SeriesPoint, Summary } from "../types";
import { ApiError } from "./client";
import { must } from "./live/errors";
import { currency } from "./live/map";
import { activeStoreId } from "./live/session";

/** One IST day of sales: a row of creator_sales_daily. */
export interface DailyRow {
  day: string; // YYYY-MM-DD, an India (IST) day
  orders_count: number;
  gross_minor: number;
}
export interface ProductSalesRow {
  product_id: string;
  title: string;
  units: number;
  revenue_minor: number;
}

const DAY = 24 * 60 * 60 * 1000;
const IST = 5.5 * 60 * 60 * 1000;
const RANGE_DAYS: Record<RangeKey, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

/** The India date for an instant, as YYYY-MM-DD. */
export const istDay = (t: number) => new Date(t + IST).toISOString().slice(0, 10);
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The days a range covers (a preset ending today, or any IST days, never past today), and the
 * days it's compared with: the same length just before, or the same dates a year earlier.
 */
export function periodBounds(range: RangeKey | Period, now: number, compare: Compare = "previous") {
  const today = dayMs(istDay(now));
  let start: number, end: number;
  if (typeof range === "string") {
    end = today;
    start = today - (RANGE_DAYS[range] - 1) * DAY;
  } else {
    end = Math.min(today, dayMs(range.to));
    start = Math.min(end, dayMs(range.from));
  }
  const days = Math.round((end - start) / DAY) + 1;
  const shift = compare === "year" ? 365 * DAY : days * DAY;
  const prev = compare === "none" ? undefined : { start: start - shift, end: end - shift };
  return { start, end, days, prev, period: { from: dayOf(start), to: dayOf(end) }, comparedWith: prev ? { from: dayOf(prev.start), to: dayOf(prev.end) } : undefined };
}
/** An IST day's start as an instant (ISO), for querying timestamps */
const istStart = (dayStart: number) => new Date(dayStart - IST).toISOString();

/**
 * The dashboard numbers, worked out from the store's daily sales (creator_sales_daily) and
 * product sales (creator_product_sales), plus the store's own visit counts (analytics_visits:
 * cookieless, from the storefront). If the visit numbers can't be read, visitors and conversion stay
 * `null` and screens say "No data yet" instead of an estimate.
 */
/** What analytics_visits answers for one period */
export interface Visits {
  visitors: number;
  viewers: number;
  started: number;
  paid: number;
  days: { day: string; visitors: number }[];
  sources: { source: string; visitors: number }[];
}

const SOURCE_NAMES = ["instagram", "direct", "google", "youtube", "twitter", "newsletter", "facebook", "linkedin", "whatsapp", "other"];

export function summarize(daily: DailyRow[], products: ProductSalesRow[], range: RangeKey | Period, now: number, cur: CurrencyCode = "INR", visits?: { now: Visits; before?: Visits }, compare: Compare = "previous"): Summary {
  const b = periodBounds(range, now, compare);
  const { start, end: today, days } = b;
  const inRange = daily.filter((r) => dayMs(r.day) >= start && dayMs(r.day) <= today);
  const prev = b.prev ? daily.filter((r) => dayMs(r.day) >= b.prev!.start && dayMs(r.day) <= b.prev!.end) : [];
  const sumIn = (rows: DailyRow[], a: number, z: number, f: (r: DailyRow) => number) => rows.filter((r) => dayMs(r.day) >= a && dayMs(r.day) < z).reduce((t, r) => t + f(r), 0);
  const seenIn = (list: Visits["days"] | undefined, a: number, z: number) => (list ?? []).filter((d) => dayMs(d.day) >= a && dayMs(d.day) < z).reduce((t, d) => t + d.visitors, 0);

  // One point per day up to a month, weekly beyond that; each with the same point of the compared period
  const step = days > 31 ? 7 : 1;
  const series: SeriesPoint[] = [];
  for (let a = start; a <= today; a += step * DAY) {
    const z = a + step * DAY;
    const dt = new Date(a);
    const p = b.prev ? b.prev.start + (a - start) : undefined;
    series.push({
      ...(visits ? { visitors: seenIn(visits.now.days, a, z) } : {}),
      label: days === 1 ? (range === "today" ? "Today" : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })) : step === 1 && days <= 7 ? dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }) : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
      revenue: sumIn(inRange, a, z, (r) => Number(r.gross_minor)) / 100,
      orders: sumIn(inRange, a, z, (r) => Number(r.orders_count)),
      ...(p !== undefined
        ? { prevRevenue: sumIn(prev, p, p + step * DAY, (r) => Number(r.gross_minor)) / 100, prevOrders: sumIn(prev, p, p + step * DAY, (r) => Number(r.orders_count)), ...(visits?.before ? { prevVisitors: seenIn(visits.before.days, p, p + step * DAY) } : {}) }
        : {}),
    });
  }

  const revenue = inRange.reduce((t, r) => t + Number(r.gross_minor), 0);
  const sales = inRange.reduce((t, r) => t + Number(r.orders_count), 0);
  const prevRevenue = prev.reduce((t, r) => t + Number(r.gross_minor), 0);
  const prevSales = prev.reduce((t, r) => t + Number(r.orders_count), 0);

  const before = visits?.before;
  return {
    range: typeof range === "string" ? range : "custom",
    period: b.period,
    comparedWith: b.comparedWith,
    revenue: money(revenue, cur),
    sales,
    visitors: visits ? visits.now.visitors : null,
    conversion: visits && visits.now.visitors > 0 ? (visits.now.paid / visits.now.visitors) * 100 : visits ? 0 : null,
    deltas: {
      revenue: b.prev ? pct(revenue, prevRevenue) : null,
      sales: b.prev ? pct(sales, prevSales) : null,
      visitors: visits && before ? pct(visits.now.visitors, before.visitors) : null,
      conversion: visits && before && visits.now.visitors > 0 && before.visitors > 0 ? pct((visits.now.paid / visits.now.visitors) * 100, (before.paid / before.visitors) * 100) : null,
    },
    series,
    topProducts: [...products]
      .sort((a, b) => Number(b.revenue_minor) - Number(a.revenue_minor))
      .slice(0, 5)
      .map((p) => ({ productId: p.product_id, title: p.title, sales: Number(p.units), revenue: money(Number(p.revenue_minor), cur) })),
    sources: (visits?.now.sources ?? []).map((s) => ({ source: (SOURCE_NAMES.includes(s.source) ? s.source : "other") as Summary["sources"][number]["source"], visitors: s.visitors, share: visits!.now.visitors ? (s.visitors / visits!.now.visitors) * 100 : 0 })),
    funnel: visits ? [{ label: "Visitors", value: visits.now.visitors }, { label: "Viewed a product", value: visits.now.viewers }, { label: "Started checkout", value: visits.now.started }, { label: "Paid", value: visits.now.paid }] : [],
  };
}

export async function getSummary(range: RangeKey | Period, compare: Compare = "previous"): Promise<Summary> {
  const storeId = await activeStoreId();
  const client = sb();
  const store = must(await client.from("stores").select("currency_base").eq("id", storeId).single());
  const cur = currency(store.currency_base);
  const now = Date.now();
  const b = periodBounds(range, now, compare);
  const visit = async (a: number, z: number): Promise<Visits | undefined> => {
    const r = await client.rpc("analytics_visits", { p_store: storeId, p_from: istStart(a), p_to: istStart(z + DAY) });
    return r.error ? undefined : (r.data as unknown as Visits);
  };
  const [daily, products, vNow, vBefore] = await Promise.all([
    client.from("creator_sales_daily").select("day, orders_count, gross_minor").eq("store_id", storeId).eq("currency", cur).gte("day", dayOf(Math.min(b.start, b.prev?.start ?? b.start))).lte("day", dayOf(b.end)).order("day"),
    client.from("creator_product_sales").select("product_id, title, units, revenue_minor").eq("store_id", storeId).eq("currency", cur),
    visit(b.start, b.end),
    b.prev ? visit(b.prev.start, b.prev.end) : Promise.resolve(undefined),
  ]);
  return summarize(must(daily) as DailyRow[], must(products) as ProductSalesRow[], range, now, cur, vNow ? { now: vNow, before: vBefore } : undefined, compare);
}

/**
 * The Analytics page: orders created in the period and their lines, plus who had bought before,
 * worked out by analyze() (lib/analytics-detail.ts). Reads up to 5,000 orders a period.
 */
export async function getAnalyticsDetail(range: RangeKey | Period): Promise<AnalyticsDetail & { currency: CurrencyCode }> {
  const storeId = await activeStoreId();
  const client = sb();
  const store = must(await client.from("stores").select("currency_base").eq("id", storeId).single());
  const cur = currency(store.currency_base);
  const now = Date.now();
  const b = periodBounds(range, now, "none");
  const start = istStart(b.start);
  const end = istStart(b.end + DAY);
  const [orders, earlier] = await Promise.all([
    client.from("orders").select("id, status, payment_method, total_minor, discount_minor, shipping_minor, buyer_email, buyer_country, created_at, paid_at, shipped_at, fulfilment_status, reminded_at").eq("store_id", storeId).eq("currency", cur).gte("created_at", start).lt("created_at", end).order("created_at").limit(5000),
    client.from("orders").select("buyer_email").eq("store_id", storeId).in("status", ["paid", "refunded"]).lt("created_at", start).limit(10000),
  ]);
  const rows = must(orders);
  // The buyer's state is in the creators' view of orders (for GST); read it for the same orders
  // In batches, so a busy period doesn't make one huge request
  const ids = rows.map((o) => o.id);
  const batches = Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, i * 150 + 150));
  const parts = await Promise.all(
    batches.map(async (b) => {
      const [st, it] = await Promise.all([
        client.from("creator_orders").select("id, buyer_state").in("id", b),
        client.from("order_items").select("order_id, product_id, title, quantity, line_total_minor").in("order_id", b),
      ]);
      return { states: must(st) as { id: string; buyer_state: string | null }[], items: must(it) as ItemRow[] };
    })
  );
  const stateOf = new Map(parts.flatMap((p) => p.states).map((s) => [s.id, s.buyer_state]));
  const items = parts.flatMap((p) => p.items);
  const detail = analyze(
    rows.map((o) => ({ ...o, buyer_email: String(o.buyer_email), total_minor: Number(o.total_minor), discount_minor: Number(o.discount_minor), shipping_minor: Number(o.shipping_minor), buyer_state: stateOf.get(o.id) ?? null })),
    items.map((i) => ({ ...i, quantity: Number(i.quantity), line_total_minor: Number(i.line_total_minor) })),
    new Set((must(earlier) as { buyer_email: string }[]).map((e) => String(e.buyer_email).toLowerCase())),
    now
  );
  return { ...detail, currency: cur };
}

export interface GoalProgress {
  /** This month's goal, or none */
  goal?: Money;
  /** Sold so far this month (India time) */
  sold: Money;
  /** Days left in the month, today included */
  daysLeft: number;
  /** What each remaining day needs to bring in to reach the goal (0 once it's reached) */
  perDay?: Money;
}

/** The store's monthly revenue goal and how this month is going */
export async function getGoalProgress(): Promise<GoalProgress> {
  const storeId = await activeStoreId();
  const client = sb();
  const store = must(await client.from("stores").select("currency_base, revenue_goal_minor").eq("id", storeId).single());
  const cur = currency(store.currency_base);
  const today = istDay(Date.now());
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = must(await client.from("creator_sales_daily").select("gross_minor").eq("store_id", storeId).eq("currency", cur).gte("day", monthStart).lte("day", today)) as { gross_minor: number }[];
  const sold = rows.reduce((t, r) => t + Number(r.gross_minor), 0);
  const [y, m] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const daysLeft = lastDay - Number(today.slice(8, 10)) + 1;
  const goal = store.revenue_goal_minor ? Number(store.revenue_goal_minor) : undefined;
  return {
    goal: goal ? money(goal, cur) : undefined,
    sold: money(sold, cur),
    daysLeft,
    perDay: goal ? money(Math.max(0, Math.ceil((goal - sold) / daysLeft)), cur) : undefined,
  };
}

/** Set (or clear, with undefined) the monthly revenue goal, in minor units of the store's currency */
export async function setRevenueGoal(amountMinor: number | undefined): Promise<void> {
  const r = await sb().from("stores").update({ revenue_goal_minor: amountMinor && amountMinor > 0 ? Math.round(amountMinor) : null }).eq("id", await activeStoreId()).select("id").single();
  if (r.error) throw new ApiError("The goal didn't save. Only people who manage the store's business settings can change it.", "validation");
}
