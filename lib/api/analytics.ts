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
 * product sales (creator_product_sales). Visits aren't tracked, so visitors, conversion, traffic
 * sources and the funnel are `null` / empty: screens say "No data yet" instead of an estimate.
 */
export function summarize(daily: DailyRow[], products: ProductSalesRow[], range: RangeKey, now: number, cur: CurrencyCode = "INR"): Summary {
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
    series.push({
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
    visitors: null,
    conversion: null,
    deltas: { revenue: pct(revenue, prevRevenue), sales: pct(sales, prevSales), visitors: null, conversion: null },
    series,
    topProducts: [...products]
      .sort((a, b) => Number(b.revenue_minor) - Number(a.revenue_minor))
      .slice(0, 5)
      .map((p) => ({ productId: p.product_id, title: p.title, sales: Number(p.units), revenue: money(Number(p.revenue_minor), cur) })),
    sources: [],
    funnel: [],
  };
}

export async function getSummary(range: RangeKey): Promise<Summary> {
  const storeId = await activeStoreId();
  const client = sb();
  const store = must(await client.from("stores").select("currency_base").eq("id", storeId).single());
  const cur = currency(store.currency_base);
  const now = Date.now();
  const from = istDay(now - (RANGE_DAYS[range] * 2 + 1) * DAY);
  const [daily, products] = await Promise.all([
    client.from("creator_sales_daily").select("day, orders_count, gross_minor").eq("store_id", storeId).eq("currency", cur).gte("day", from).order("day"),
    client.from("creator_product_sales").select("product_id, title, units, revenue_minor").eq("store_id", storeId).eq("currency", cur),
  ]);
  return summarize(must(daily) as DailyRow[], must(products) as ProductSalesRow[], range, now, cur);
}
