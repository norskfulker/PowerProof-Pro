import { paymentSummary, periodOf, salesSummary, visitorSummary, type MetricRange, type MetricSummary, type PaymentRow } from "../dashboard-metrics";
import { NEEDS_REASON, type PaymentEventKind, type PaymentEventSource } from "../payment-events";
import { sb } from "../supabase/browser";
import type { CurrencyCode } from "../types";
import { must } from "./live/errors";
import { currency } from "./live/map";
import { activeStoreId } from "./live/session";

/**
 * Live store data for the dashboard, Payments and Live activity pages: read from the database
 * (orders, payment_events, store_events, reviews, questions, products) and kept current through
 * Supabase Realtime. Row-level security limits every read and every live update to the stores the
 * signed-in person works on.
 */

/* Tables added after the generated types: read untyped, with each row's shape stated here */
type Untyped = { from: (table: string) => { select: (cols: string) => Filter } };
type Filter = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> & {
  eq: (c: string, v: unknown) => Filter;
  in: (c: string, v: unknown[]) => Filter;
  gte: (c: string, v: string) => Filter;
  lt: (c: string, v: string) => Filter;
  order: (c: string, o: { ascending: boolean }) => Filter;
  limit: (n: number) => Filter;
};
const untyped = () => sb() as unknown as Untyped;
async function rowsOf<T>(q: Filter, what: string): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(`We couldn't load ${what}.`);
  return (data ?? []) as T[];
}

/* Dashboard metrics -------------------------------------------------------------------------- */

export interface DashboardMetrics {
  range: MetricRange;
  currency: CurrencyCode;
  sales: MetricSummary;
  visitors: MetricSummary;
  payments: MetricSummary & { succeeded: number; failed: number };
}

export async function getDashboardMetrics(range: MetricRange, now = Date.now()): Promise<DashboardMetrics> {
  const storeId = await activeStoreId();
  const client = sb();
  const { prevStart, end } = periodOf(range, now);
  const from = new Date(prevStart).toISOString();
  const to = new Date(end).toISOString();
  const store = must(await client.from("stores").select("currency_base").eq("id", storeId).single());
  const cur = currency(store.currency_base);
  const [paid, visits, pays] = await Promise.all([
    client.from("orders").select("total_minor, paid_at").eq("store_id", storeId).eq("currency", cur).in("status", ["paid", "refunded"]).gte("paid_at", from).lt("paid_at", to).limit(10000),
    client.from("store_events").select("created_at, session").eq("store_id", storeId).eq("kind", "view").gte("created_at", from).lt("created_at", to).order("created_at", { ascending: true }).limit(50000),
    rowsOf<{ kind: PaymentRow["kind"]; occurred_at: string; amount_minor: number | null }>(
      untyped().from("payment_events").select("kind, occurred_at, amount_minor").eq("store_id", storeId).in("kind", ["succeeded", "failed", "abandoned", "expired"]).gte("occurred_at", from).lt("occurred_at", to).limit(20000),
      "payments"
    ),
  ]);
  return {
    range,
    currency: cur,
    sales: salesSummary(must(paid).map((r) => ({ at: r.paid_at as string, amountMinor: Number(r.total_minor) })), range, now),
    visitors: visitorSummary(must(visits).map((r) => ({ at: r.created_at, session: r.session })), range, now),
    payments: paymentSummary(pays.map((r) => ({ at: r.occurred_at, kind: r.kind, amountMinor: Number(r.amount_minor ?? 0) })), range, now),
  };
}

/* Payment activity ---------------------------------------------------------------------------- */

export interface PaymentEvent {
  id: string;
  orderId: string | null;
  orderRef?: string;
  buyerName?: string;
  provider: string;
  kind: PaymentEventKind;
  source: PaymentEventSource;
  paymentId: string | null;
  refundId: string | null;
  amountMinor: number | null;
  currency: string | null;
  method: string | null;
  /** The provider's own words; null when it gave none */
  reason: string | null;
  /** True when the step usually has a reason and the provider gave none ("Reason unavailable") */
  reasonMissing: boolean;
  errorCode: string | null;
  occurredAt: string;
}

type PaymentRowDb = { id: string; order_id: string | null; provider: string; kind: PaymentEventKind; source: PaymentEventSource; payment_id: string | null; refund_id: string | null; amount_minor: number | null; currency: string | null; method: string | null; reason: string | null; error_code: string | null; occurred_at: string };

export async function getPaymentEvents(opts: { orderId?: string; kinds?: PaymentEventKind[]; since?: string; limit?: number } = {}): Promise<PaymentEvent[]> {
  const storeId = await activeStoreId();
  let q = untyped().from("payment_events").select("id, order_id, provider, kind, source, payment_id, refund_id, amount_minor, currency, method, reason, error_code, occurred_at").eq("store_id", storeId);
  if (opts.orderId) q = q.eq("order_id", opts.orderId);
  if (opts.kinds?.length) q = q.in("kind", opts.kinds);
  if (opts.since) q = q.gte("occurred_at", opts.since);
  const rows = await rowsOf<PaymentRowDb>(q.order("occurred_at", { ascending: false }).limit(opts.limit ?? 200), "payment activity");
  // The order's number and the buyer's name, as the creator may see them
  const ids = [...new Set(rows.map((r) => r.order_id).filter((x): x is string => !!x))];
  const orders = ids.length ? must(await sb().from("creator_orders").select("id, ref, buyer_name").in("id", ids)) : [];
  const byId = new Map(orders.map((o) => [o.id as string, o]));
  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    orderRef: r.order_id ? (byId.get(r.order_id)?.ref as string | undefined) : undefined,
    buyerName: r.order_id ? (byId.get(r.order_id)?.buyer_name as string | undefined) : undefined,
    provider: r.provider,
    kind: r.kind,
    source: r.source,
    paymentId: r.payment_id,
    refundId: r.refund_id,
    amountMinor: r.amount_minor == null ? null : Number(r.amount_minor),
    currency: r.currency,
    method: r.method,
    reason: r.reason,
    reasonMissing: !r.reason && NEEDS_REASON.includes(r.kind),
    errorCode: r.error_code,
    occurredAt: r.occurred_at,
  }));
}

/* Store activity ------------------------------------------------------------------------------ */

export type ActivityCategory = "visitors" | "products" | "cart" | "checkout" | "orders" | "payments" | "reviews" | "support" | "store";
export const ACTIVITY_CATEGORIES: { value: ActivityCategory; label: string }[] = [
  { value: "visitors", label: "Visitors" },
  { value: "products", label: "Product views" },
  { value: "cart", label: "Add to cart" },
  { value: "checkout", label: "Checkout" },
  { value: "orders", label: "Orders" },
  { value: "payments", label: "Payments" },
  { value: "reviews", label: "Reviews" },
  { value: "support", label: "Customer questions" },
  { value: "store", label: "Store changes" },
];

export interface ActivityItem {
  id: string;
  category: ActivityCategory;
  title: string;
  detail?: string;
  /** e.g. "Paid", "Waiting", "Answered" */
  status?: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  at: string;
  href?: string;
}

export interface StoreActivity {
  items: ActivityItem[];
  /** Distinct visitors seen in the last 5 minutes */
  activeNow: number;
  counts: { visitors: number; productViews: number; carts: number; checkouts: number; orders: number };
}

const ACTIVE_WINDOW = 5 * 60_000;

/** Everything that happened in the store since `since`, newest first */
export async function getStoreActivity(since: string, now = Date.now()): Promise<StoreActivity> {
  const storeId = await activeStoreId();
  const client = sb();
  const [events, orders, pays, reviews, questions, products] = await Promise.all([
    client.from("store_events").select("id, kind, path, product_id, session, created_at").eq("store_id", storeId).gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
    client.from("creator_orders").select("id, ref, status, total_minor, currency, payment_method, created_at, paid_at, cancelled_at, fulfilment_status, shipped_at, delivered_at").eq("store_id", storeId).or(`created_at.gte.${since},paid_at.gte.${since},cancelled_at.gte.${since},shipped_at.gte.${since},delivered_at.gte.${since}`).limit(500),
    getPaymentEvents({ since, limit: 300 }),
    client.from("reviews").select("id, rating, reviewer_name, status, created_at").eq("store_id", storeId).gte("created_at", since).limit(200),
    client.from("questions").select("id, asker_name, status, answered_at, created_at").eq("store_id", storeId).gte("created_at", since).limit(200),
    client.from("products").select("id, title, status, updated_at, created_at, track_stock, stock").eq("store_id", storeId).limit(1000),
  ]);
  const ev = must(events);
  // The view's columns are nullable in the generated types; every order has a creation time
  const ords = must(orders).map((o) => ({ ...o, created_at: o.created_at ?? "" }));
  const titleOf = new Map(must(products).map((p) => [p.id, p.title]));
  const items: ActivityItem[] = [];

  for (const e of ev) {
    const product = e.product_id ? titleOf.get(e.product_id) : undefined;
    if (e.kind === "view") items.push({ id: `v${e.id}`, category: "visitors", title: "Page view", detail: e.path, at: e.created_at });
    else if (e.kind === "product") items.push({ id: `p${e.id}`, category: "products", title: `Viewed ${product ?? "a product"}`, at: e.created_at, href: e.product_id ? `/catalog/products/${e.product_id}` : undefined });
    else if (e.kind === "cart") items.push({ id: `c${e.id}`, category: "cart", title: `Added ${product ?? "a product"} to cart`, at: e.created_at, href: e.product_id ? `/catalog/products/${e.product_id}` : undefined, tone: "info" });
  }

  for (const o of ords) {
    const href = `/sales/orders/${o.id}`;
    if (o.created_at >= since) {
      items.push(
        o.payment_method === "cod"
          ? { id: `o${o.id}`, category: "orders", title: `Order ${o.ref} placed (cash on delivery)`, at: o.created_at, href, status: "Cash on delivery", tone: "info" }
          : { id: `k${o.id}`, category: "checkout", title: `Checkout started: ${o.ref}`, at: o.created_at, href, status: o.status === "paid" ? "Completed" : o.status === "cancelled" ? "Abandoned" : "Waiting for payment", tone: o.status === "paid" ? "success" : o.status === "cancelled" ? "warning" : "neutral" }
      );
    }
    if (o.paid_at && o.paid_at >= since) items.push({ id: `op${o.id}`, category: "orders", title: `Order ${o.ref} paid`, at: o.paid_at, href, status: "Paid", tone: "success" });
    if (o.cancelled_at && o.cancelled_at >= since) items.push({ id: `oc${o.id}`, category: "orders", title: `Order ${o.ref} cancelled`, detail: "No payment within 1 hour", at: o.cancelled_at, href, status: "Cancelled", tone: "warning" });
    if (o.shipped_at && o.shipped_at >= since) items.push({ id: `os${o.id}`, category: "orders", title: `Order ${o.ref} shipped`, at: o.shipped_at, href, status: "Shipped", tone: "info" });
    if (o.delivered_at && o.delivered_at >= since) items.push({ id: `od${o.id}`, category: "orders", title: `Order ${o.ref} delivered`, at: o.delivered_at, href, status: "Delivered", tone: "success" });
  }

  for (const p of pays) {
    if (p.kind === "succeeded" || p.kind === "initiated") continue; // shown as the order's own lines
    items.push({ id: `pay${p.id}`, category: "payments", title: `${p.orderRef ? `${p.orderRef}: ` : ""}${p.kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}`, detail: p.reason ?? (p.reasonMissing ? "Reason unavailable" : undefined), at: p.occurredAt, href: p.orderId ? `/sales/orders/${p.orderId}` : undefined, tone: p.kind === "failed" || p.kind === "late_payment" || p.kind === "refund_failed" ? "danger" : "warning" });
  }

  for (const r of must(reviews)) items.push({ id: `r${r.id}`, category: "reviews", title: `${r.rating}★ review from ${r.reviewer_name}`, at: r.created_at, href: "/store/current/design/pages/home/edit?panel=reviews", status: String(r.status), tone: Number(r.rating) <= 2 ? "warning" : "success" });
  for (const q of must(questions)) items.push({ id: `q${q.id}`, category: "support", title: `Question from ${q.asker_name}`, at: q.created_at, href: "/store/current/design/pages/home/edit?panel=questions", status: q.answered_at ? "Answered" : "Waiting", tone: q.answered_at ? "success" : "warning" });
  for (const p of must(products)) {
    if (p.updated_at >= since && p.updated_at !== p.created_at) items.push({ id: `pu${p.id}${p.updated_at}`, category: "store", title: `${p.title} updated`, detail: p.track_stock ? `${p.stock ?? 0} in stock` : undefined, at: p.updated_at, href: `/catalog/products/${p.id}`, status: p.status === "live" ? "Live" : p.status === "draft" ? "Draft" : "Archived" });
    else if (p.created_at >= since) items.push({ id: `pn${p.id}`, category: "store", title: `${p.title} added`, at: p.created_at, href: `/catalog/products/${p.id}` });
  }

  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const recent = ev.filter((e) => Date.parse(e.created_at) >= now - ACTIVE_WINDOW);
  return {
    items: items.slice(0, 400),
    activeNow: new Set(recent.map((e) => e.session)).size,
    counts: {
      visitors: new Set(ev.filter((e) => e.kind === "view").map((e) => e.session)).size,
      productViews: ev.filter((e) => e.kind === "product").length,
      carts: ev.filter((e) => e.kind === "cart").length,
      checkouts: ords.filter((o) => o.created_at >= since && o.payment_method !== "cod").length,
      orders: ords.filter((o) => (o.paid_at && o.paid_at >= since) || (o.payment_method === "cod" && o.created_at >= since)).length,
    },
  };
}

/* Live updates -------------------------------------------------------------------------------- */

export type LiveStatus = "connecting" | "live" | "offline";
/** Each subscriber gets its own channel, so two widgets on one page don't share (and close) one */
let channelSeq = 0;

/**
 * Calls `onChange` when any of these tables changes for the active store (Supabase Realtime, with
 * row-level security), and reports whether the connection is up. Returns the unsubscribe.
 */
export function watchStore(tables: string[], onChange: () => void, onStatus: (s: LiveStatus) => void): () => void {
  let channel: ReturnType<ReturnType<typeof sb>["channel"]> | undefined;
  let stopped = false;
  onStatus("connecting");
  void activeStoreId().then(
    (storeId) => {
      if (stopped) return;
      const c = sb().channel(`store-live:${storeId}:${tables.join(",")}:${++channelSeq}`);
      for (const table of tables) c.on("postgres_changes" as never, { event: "*", schema: "public", table, filter: `store_id=eq.${storeId}` } as never, () => onChange());
      c.subscribe((status: string) => onStatus(status === "SUBSCRIBED" ? "live" : status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "offline" : "connecting"));
      channel = c;
    },
    () => onStatus("offline")
  );
  return () => {
    stopped = true;
    if (channel) void sb().removeChannel(channel);
  };
}
