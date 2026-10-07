import { sb } from "../../supabase/browser";
import type { Customer, Order, OrderItem } from "../../types";
import { ApiError } from "../client";
import type { CustomerQuery, OrderQuery } from "../orders";
import { must } from "./errors";
import { currency, money } from "./map";
import { activeStoreId } from "./session";

/**
 * Sales screens from orders, order lines and the ledger. Creators read their own store's orders
 * (never the buyer's phone: that column isn't granted). Customers are buyers grouped by email.
 */

/**
 * Creators read orders through creator_orders: a view that runs as the signed-in creator and only
 * holds columns they may see (never the buyer's phone). `select *` is safe on it; the base
 * `orders` table refuses it.
 */
type Row = { id: string; ref: string; store_id: string; buyer_name: string; buyer_email: string; buyer_country: string | null; currency: string; subtotal_minor: number; discount_minor: number; total_minor: number; deals_applied: unknown; status: "pending" | "paid" | "failed" | "refunded"; invoice_no: string | null; paid_at: string | null; created_at: string };

/** Buyers have no accounts, so a customer is identified by their email. */
export const customerId = (email: string) => `c_${encodeURIComponent(email.toLowerCase())}`;

function dealIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : (x as { id?: string; rule_id?: string })?.id ?? (x as { rule_id?: string })?.rule_id)).filter((x): x is string => typeof x === "string");
}

async function load(storeId: string): Promise<Order[]> {
  const client = sb();
  const rows = must(await client.from("creator_orders").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(1000)) as Row[];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [items, ledger, refunds] = await Promise.all([
    client.from("order_items").select("order_id, product_id, title, unit_price_minor, quantity, discount_minor, line_total_minor, is_gift").in("order_id", ids),
    client.from("ledger_entries").select("order_id, account, kind, amount_minor").in("order_id", ids),
    client.from("refunds").select("order_id, reason, status, created_at").in("order_id", ids),
  ]);

  return rows.map((r): Order => {
    const cur = currency(r.currency);
    const lines = (items.data ?? []).filter((i) => i.order_id === r.id);
    const entries = (ledger.data ?? []).filter((e) => e.order_id === r.id);
    const sum = (f: (e: (typeof entries)[number]) => boolean) => entries.filter(f).reduce((t, e) => t + Math.abs(Number(e.amount_minor)), 0);
    const refund = (refunds.data ?? []).find((x) => x.order_id === r.id);
    const first = lines.find((l) => !l.is_gift) ?? lines[0];
    const orderItems: OrderItem[] = lines.map((l) => ({
      productId: l.product_id ?? "",
      title: l.title,
      price: money(l.line_total_minor, cur),
      kind: l.is_gift ? "deal" : "product",
      basePrice: Number(l.discount_minor) > 0 ? money(Number(l.unit_price_minor) * l.quantity, cur) : undefined,
      free: l.is_gift || Number(l.line_total_minor) === 0 ? true : undefined,
      gift: l.is_gift || undefined,
    }));
    const platform = sum((e) => e.kind === "platform_fee" && e.account === "platform");
    const gateway = sum((e) => e.kind === "gateway_fee" && e.account === "gateway");
    // What the creator keeps: their side of the ledger for this order
    const creator = entries.filter((e) => e.account === "creator" && e.kind !== "payout").reduce((t, e) => t + Number(e.amount_minor), 0);
    return {
      id: r.id,
      token: "",
      storeId: r.store_id,
      number: r.ref,
      productId: first?.product_id ?? "",
      productTitle: first?.title ?? "Order",
      customerId: customerId(r.buyer_email),
      buyerName: r.buyer_name,
      buyerEmail: r.buyer_email,
      country: r.buyer_country ?? "",
      countryCode: r.buyer_country ?? "",
      buyerTotal: money(r.total_minor, cur),
      total: money(r.total_minor, cur),
      fees: { gateway: money(gateway, cur), platform: money(platform, cur) },
      net: money(r.status === "paid" ? Math.max(0, creator) : 0, cur),
      status: r.status,
      invoiceNumber: r.invoice_no ?? undefined,
      createdAt: r.created_at,
      paidAt: r.paid_at ?? undefined,
      refundedAt: r.status === "refunded" ? refund?.created_at ?? r.paid_at ?? r.created_at : undefined,
      refundReason: refund?.reason ?? undefined,
      items: orderItems,
      discount: Number(r.discount_minor) > 0 ? money(r.discount_minor, cur) : undefined,
      dealRuleIds: dealIds(r.deals_applied),
    };
  });
}

export async function getOrders(q: OrderQuery = {}): Promise<Order[]> {
  // Disputes come from the payment gateway and arrive with the payments stage
  if (q.disputed) return [];
  const s = q.search?.trim().toLowerCase();
  const list = (await load(await activeStoreId())).filter(
    (o) =>
      (!s || o.number.toLowerCase().includes(s) || o.buyerEmail.toLowerCase().includes(s) || o.buyerName.toLowerCase().includes(s) || o.productTitle.toLowerCase().includes(s)) &&
      (!q.status || q.status === "all" || o.status === q.status) &&
      (!q.productId || o.items.some((i) => i.productId === q.productId)) &&
      (!q.customerId || o.customerId === q.customerId)
  );
  return q.limit ? list.slice(0, q.limit) : list;
}

export async function getRecentOrders(limit = 8): Promise<Order[]> {
  // Latest first, pending ones included: each row shows its status
  return (await getOrders({ limit }));
}

export async function getOrder(id: string): Promise<Order> {
  const o = (await getOrders()).find((x) => x.id === id || x.number === id);
  if (!o) throw new ApiError("Order not found.", "not_found");
  return o;
}

type CustomerRow = { buyer_email: string; buyer_name: string | null; buyer_country: string | null; currency: string; orders_count: number; total_spent_minor: number; first_order_at: string; last_order_at: string };

/** Paid buyers grouped by email, from creator_customers (there is no phone number for creators). */
export async function getCustomers(q: CustomerQuery = {}): Promise<Customer[]> {
  const rows = must(await sb().from("creator_customers").select("*").eq("store_id", await activeStoreId()).order("last_order_at", { ascending: false })) as CustomerRow[];
  const s = q.search?.trim().toLowerCase();
  return rows
    .map(customerFrom)
    .filter((c) => (!s || c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s)) && (!q.country || q.country === "all" || c.countryCode === q.country));
}

function customerFrom(r: CustomerRow): Customer {
  const cur = currency(r.currency);
  return { id: customerId(r.buyer_email), name: r.buyer_name ?? r.buyer_email, email: r.buyer_email, country: r.buyer_country ?? "", countryCode: r.buyer_country ?? "", currency: cur, ordersCount: Number(r.orders_count), totalSpent: money(Number(r.total_spent_minor), cur), firstOrderAt: r.first_order_at, lastOrderAt: r.last_order_at };
}

export async function getCustomer(id: string): Promise<{ customer: Customer; orders: Order[] }> {
  const customer = (await getCustomers()).find((c) => c.id === id);
  if (!customer) throw new ApiError("Customer not found.", "not_found");
  return { customer, orders: await getOrders({ customerId: id }) };
}

export async function refundOrder(): Promise<Order> {
  throw new ApiError("Refunds from the dashboard open once payments are connected.", "validation");
}

export async function resendReceipt(): Promise<void> {
  throw new ApiError("Resending receipts opens once emails are connected.", "validation");
}
