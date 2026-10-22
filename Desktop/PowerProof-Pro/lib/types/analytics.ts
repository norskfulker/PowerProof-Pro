import type { Money } from "./money";
import type { TrafficSource } from "./order";

export type RangeKey = "today" | "7d" | "30d" | "90d";
/** Any stretch of India (IST) days, both ends included: YYYY-MM-DD */
export interface Period {
  from: string;
  to: string;
}
/** What a period is compared with: the same length just before it, the same dates a year earlier, or nothing */
export type Compare = "previous" | "year" | "none";

export interface SeriesPoint {
  label: string;
  revenue: number; // major units, for charts only
  orders: number;
  /** Distinct visitors that day (or week); absent when nothing was recorded */
  visitors?: number;
  /** The same point in the period it's compared with */
  prevRevenue?: number;
  prevOrders?: number;
  prevVisitors?: number;
}

export interface Summary {
  range: RangeKey | "custom";
  /** The days it covers, and what it was compared with (IST days) */
  period: Period;
  comparedWith?: Period;
  revenue: Money;
  sales: number;
  /** Null until visits are tracked: screens show "No data yet" */
  visitors: number | null;
  conversion: number | null; // percent
  /** Percent change versus the previous period; null when there is nothing to compare with */
  deltas: { revenue: number | null; sales: number | null; visitors: number | null; conversion: number | null };
  series: SeriesPoint[];
  topProducts: { productId: string; title: string; sales: number; revenue: Money }[];
  sources: { source: TrafficSource; visitors: number; share: number }[];
  funnel: { label: string; value: number }[];
}
