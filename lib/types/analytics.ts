import type { Money } from "./money";
import type { TrafficSource } from "./order";

export type RangeKey = "today" | "7d" | "30d" | "90d";

export interface SeriesPoint {
  label: string;
  revenue: number; // major units, for charts only
  visitors: number;
  orders: number;
}

export interface Summary {
  range: RangeKey;
  revenue: Money;
  sales: number;
  visitors: number;
  conversion: number; // percent
  deltas: { revenue: number; sales: number; visitors: number; conversion: number };
  series: SeriesPoint[];
  topProducts: { productId: string; title: string; sales: number; revenue: Money }[];
  sources: { source: TrafficSource; visitors: number; share: number }[];
  funnel: { label: string; value: number }[];
}
