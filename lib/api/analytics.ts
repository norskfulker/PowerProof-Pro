import { money } from "../money";
import { sb } from "../supabase/browser";
import type { CurrencyCode, RangeKey, SeriesPoint, Summary } from "../types";
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

export function summarize(daily: DailyRow[], products: ProductSalesRow[], range: RangeKey, now: number, cur: CurrencyCode = "INR", visits?: { now: Visits; before: Visits }): Summary {
  const days = RANGE_DAYS[range];
  const today = dayMs(istDay(now));
  const start = today - (days - 1) * DAY;
  const prevStart = start - days * DAY;
  const inRange = daily.filter((r) => dayMs(r.day) >= start && dayMs(r.day) <= today);
  const prev = daily.filter((r) => dayMs(r.day) >= prevStart && dayMs(r.day) < start);

  // One point per day up to 30 days, weekly beyond that
  const step = days > 30 ? 7 : 1;
  const series: SeriesPoint[] = [];
  for (let a = start; a <= today; a += step * DAY) {
    const rows = inRange.filter((r) => dayMs(r.day) >= a && dayMs(r.day) < a + step * DAY);
    const dt = new Date(a);
    const seen = (visits?.now.days ?? []).filter((d) => dayMs(d.day) >= a && dayMs(d.day) < a + step * DAY).reduce((t, d) => t + d.visitors, 0);
    series.push({
      ...(visits ? { visitors: seen } : {}),
      label: range === "today" ? "Today" : step === 1 && days <= 7 ? dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }) : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
      revenue: rows.reduce((t, r) => t + Number(r.gross_minor), 0) / 100,
      orders: rows.reduce((t, r) => t + Number(r.orders_count), 0),
    });
  }

  const revenue = inRange.reduce((t, r) => t + Number(r.gross_minor), 0);
  const sales = inRange.reduce((t, r) => t + Number(r.orders_count), 0);
  const prevRevenue = prev.reduce((t, r) => t + Number(r.gross_minor), 0);
  const prevSales = prev.reduce((t, r) => t + Number(r.orders_count), 0);

  return {
    range,
    revenue: money(revenue, cur),
    sales,
    visitors: visits ? visits.now.visitors : null,
    conversion: visits && visits.now.visitors > 0 ? (visits.now.paid / visits.now.visitors) * 100 : visits ? 0 : null,
    deltas: {
      revenue: pct(revenue, prevRevenue),
      sales: pct(sales, prevSales),
      visitors: visits ? pct(visits.now.visitors, visits.before.visitors) : null,
      conversion: visits && visits.now.visitors > 0 && visits.before.visitors > 0 ? pct((visits.now.paid / visits.now.visitors) * 100, (visits.before.paid / visits.before.visitors) * 100) : null,
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

export async function getSummary(range: RangeKey): Promise<Summary> {
  const storeId = await activeStoreId();
  const client = sb();
  const store = must(await client.from("stores").select("currency_base").eq("id", storeId).single());
  const cur = currency(store.currency_base);
  const now = Date.now();
  const from = istDay(now - (RANGE_DAYS[range] * 2 + 1) * DAY);
  const periodStart = (n: number) => new Date(dayMs(istDay(now)) - IST + (1 - n) * DAY).toISOString();
  const days = RANGE_DAYS[range];
  const visit = async (a: string, b: string): Promise<Visits | undefined> => {
    const r = await client.rpc("analytics_visits", { p_store: storeId, p_from: a, p_to: b });
    return r.error ? undefined : (r.data as unknown as Visits);
  };
  const [daily, products, vNow, vBefore] = await Promise.all([
    client.from("creator_sales_daily").select("day, orders_count, gross_minor").eq("store_id", storeId).eq("currency", cur).gte("day", from).order("day"),
    client.from("creator_product_sales").select("product_id, title, units, revenue_minor").eq("store_id", storeId).eq("currency", cur),
    visit(periodStart(days), new Date(now + DAY).toISOString()),
    visit(periodStart(days * 2), periodStart(days)),
  ]);
  return summarize(must(daily) as DailyRow[], must(products) as ProductSalesRow[], range, now, cur, vNow && vBefore ? { now: vNow, before: vBefore } : undefined);
}
