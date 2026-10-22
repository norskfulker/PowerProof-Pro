/**
 * The Analytics page's numbers, worked out from the store's orders and their lines for one period.
 * Pure: the API layer reads the rows (creator_orders, order_items) and this turns them into what
 * the page shows. Amounts are minor units in the store's currency; times are India (IST) days and
 * hours, like the dashboard.
 */

export interface OrderRow {
  id: string;
  status: "pending" | "cod" | "paid" | "failed" | "refunded" | string;
  payment_method: string | null;
  total_minor: number;
  discount_minor: number;
  shipping_minor: number;
  buyer_email: string;
  buyer_country: string | null;
  buyer_state: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  fulfilment_status: string | null;
  reminded_at: string | null;
}

export interface ItemRow {
  order_id: string;
  product_id: string | null;
  title: string;
  quantity: number;
  line_total_minor: number;
}

export interface Breakdown {
  key: string;
  orders: number;
  revenue: number;
  share: number;
}

export interface AnalyticsDetail {
  /** Paid and refunded orders: what came in before refunds */
  gross: number;
  refunds: number;
  refundCount: number;
  /** Gross less refunds */
  net: number;
  orders: number;
  /** Average order value (gross over orders that were paid) */
  aov: number;
  /** Placed for cash on delivery and not collected yet */
  codPending: number;
  codPendingCount: number;
  buyers: number;
  /** Buyers who had bought before (this period or earlier) */
  returning: number;
  discountOrders: number;
  discountGiven: number;
  products: { productId: string | null; title: string; units: number; revenue: number; orders: number; share: number }[];
  countries: Breakdown[];
  states: Breakdown[];
  payments: Breakdown[];
  /** Paid orders by IST weekday (0 = Monday) and hour */
  heat: number[][];
  checkout: {
    started: number;
    paid: number;
    /** Started and not paid (more than an hour ago), or failed */
    abandoned: number;
    abandonedValue: number;
    reminded: number;
    /** Reminded, and the same buyer paid an order afterwards */
    recovered: number;
    recoveredValue: number;
  };
  shipping: { toShip: number; shipped: number; delivered: number; avgHoursToShip: number | null };
}

const IST = 5.5 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const counted = (o: OrderRow) => o.status === "paid" || o.status === "refunded";

function breakdown(rows: OrderRow[], keyOf: (o: OrderRow) => string | null | undefined, limit = 8): Breakdown[] {
  const m = new Map<string, { orders: number; revenue: number }>();
  for (const o of rows) {
    const k = keyOf(o);
    if (!k) continue;
    const e = m.get(k) ?? { orders: 0, revenue: 0 };
    e.orders += 1;
    e.revenue += Number(o.total_minor);
    m.set(k, e);
  }
  const total = [...m.values()].reduce((t, e) => t + e.revenue, 0);
  return [...m.entries()]
    .map(([key, e]) => ({ key, ...e, share: total ? (e.revenue / total) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
    .slice(0, limit);
}

/**
 * @param orders every order created in the period
 * @param items the lines of those orders
 * @param earlierBuyers emails that had a paid order before the period
 * @param later orders after the period's reminders (paid ones, for recovery), may overlap `orders`
 */
export function analyze(orders: OrderRow[], items: ItemRow[], earlierBuyers: Set<string>, now: number, later: OrderRow[] = orders): AnalyticsDetail {
  const sold = orders.filter(counted);
  const refunded = orders.filter((o) => o.status === "refunded");
  const gross = sold.reduce((t, o) => t + Number(o.total_minor), 0);
  const refunds = refunded.reduce((t, o) => t + Number(o.total_minor), 0);
  const cod = orders.filter((o) => o.status === "cod");

  // Buyers: someone who bought twice in the period, or bought before it, is returning
  const seen = new Map<string, number>();
  for (const o of sold) seen.set(o.buyer_email.toLowerCase(), (seen.get(o.buyer_email.toLowerCase()) ?? 0) + 1);
  const returning = [...seen.entries()].filter(([e, n]) => n > 1 || earlierBuyers.has(e)).length;

  // Products, from the lines of sold orders
  const soldIds = new Set(sold.map((o) => o.id));
  const pm = new Map<string, { productId: string | null; title: string; units: number; revenue: number; orders: Set<string> }>();
  for (const i of items) {
    if (!soldIds.has(i.order_id)) continue;
    const k = i.product_id ?? `t:${i.title}`;
    const e = pm.get(k) ?? { productId: i.product_id, title: i.title, units: 0, revenue: 0, orders: new Set<string>() };
    e.units += Number(i.quantity);
    e.revenue += Number(i.line_total_minor);
    e.orders.add(i.order_id);
    pm.set(k, e);
  }
  const productTotal = [...pm.values()].reduce((t, e) => t + e.revenue, 0);
  const products = [...pm.values()]
    .map((e) => ({ productId: e.productId, title: e.title, units: e.units, revenue: e.revenue, orders: e.orders.size, share: productTotal ? (e.revenue / productTotal) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // When people buy: weekday × hour, India time
  const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const o of sold) {
    const d = new Date(Date.parse(o.paid_at ?? o.created_at) + IST);
    heat[(d.getUTCDay() + 6) % 7][d.getUTCHours()] += 1;
  }

  // Checkout: what was started, left, reminded and won back
  const abandonedRows = orders.filter((o) => o.status === "failed" || (o.status === "pending" && now - Date.parse(o.created_at) > HOUR));
  const reminded = orders.filter((o) => o.reminded_at);
  const paidLater = later.filter((o) => o.status === "paid" || o.status === "cod");
  const recoveredRows = reminded.filter((r) => paidLater.some((p) => p.buyer_email.toLowerCase() === r.buyer_email.toLowerCase() && Date.parse(p.created_at) > Date.parse(r.reminded_at!)));

  // Shipping, for orders with something to send
  const ships = orders.filter((o) => o.fulfilment_status && o.status !== "failed" && o.status !== "pending");
  const shipTimes = ships.filter((o) => o.shipped_at).map((o) => (Date.parse(o.shipped_at!) - Date.parse(o.paid_at ?? o.created_at)) / HOUR).filter((h) => h >= 0);

  return {
    gross,
    refunds,
    refundCount: refunded.length,
    net: gross - refunds,
    orders: sold.length + cod.length,
    aov: sold.length ? Math.round(gross / sold.length) : 0,
    codPending: cod.reduce((t, o) => t + Number(o.total_minor), 0),
    codPendingCount: cod.length,
    buyers: seen.size,
    returning,
    discountOrders: sold.filter((o) => Number(o.discount_minor) > 0).length,
    discountGiven: sold.reduce((t, o) => t + Number(o.discount_minor), 0),
    products,
    countries: breakdown(sold, (o) => o.buyer_country),
    states: breakdown(sold.filter((o) => o.buyer_country === "IN"), (o) => o.buyer_state),
    payments: breakdown([...sold, ...cod], (o) => (o.payment_method === "cod" ? "Cash on delivery" : Number(o.total_minor) === 0 ? "Free" : "Online"), 3),
    heat,
    checkout: {
      started: orders.length,
      paid: sold.length + cod.length,
      abandoned: abandonedRows.length,
      abandonedValue: abandonedRows.reduce((t, o) => t + Number(o.total_minor), 0),
      reminded: reminded.length,
      recovered: recoveredRows.length,
      recoveredValue: recoveredRows.reduce((t, o) => t + Number(o.total_minor), 0),
    },
    shipping: {
      toShip: ships.filter((o) => o.fulfilment_status === "unfulfilled").length,
      shipped: ships.filter((o) => o.fulfilment_status === "shipped").length,
      delivered: ships.filter((o) => o.fulfilment_status === "delivered").length,
      avgHoursToShip: shipTimes.length ? shipTimes.reduce((t, h) => t + h, 0) / shipTimes.length : null,
    },
  };
}
