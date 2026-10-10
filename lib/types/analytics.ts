import type { Money } from "./money";
import type { TrafficSource } from "./order";

export type RangeKey = "today" | "7d" | "30d" | "90d";

export interface SeriesPoint {
  label: string;
  revenue: number; // major units, for charts only
  orders: number;
  /** Distinct visitors that day (or week); absent when nothing was recorded */
  visitors?: number;
}

export interface Summary {
  range: RangeKey;
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
