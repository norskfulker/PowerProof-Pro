import { adminDb } from "../mock/admin";
import { commit, db } from "../mock/db";
import type { Customer, Order, OrderStatus } from "../types";
import { call, notFound } from "./client";
import { ApiError } from "./client";

export interface OrderQuery {
  search?: string;
  status?: OrderStatus | "all";
  productId?: string;
  customerId?: string;
  /** Only orders with an open dispute (Sales › Orders › Disputed) */
  disputed?: boolean;
  limit?: number;
}

export function getOrders(q: OrderQuery = {}): Promise<Order[]> {
  return call(() => {
    const s = q.search?.trim().toLowerCase();
    const disputed = q.disputed ? new Set(adminDb().disputes.filter((x) => x.status === "open" || x.status === "under_review").map((x) => x.orderNumber)) : undefined;
    const list = db().orders.filter(
      (o) =>
        (!s ||
          o.number.toLowerCase().includes(s) ||
          o.buyerEmail.toLowerCase().includes(s) ||
          o.buyerName.toLowerCase().includes(s) ||
          o.productTitle.toLowerCase().includes(s)) &&
        (!q.status || q.status === "all" || o.status === q.status) &&
        (!q.productId || o.productId === q.productId) &&
        (!q.customerId || o.customerId === q.customerId) &&
        (!disputed || disputed.has(o.number))
    );
    return q.limit ? list.slice(0, q.limit) : list;
  });
}

/** Lightweight read for the live feed: short latency, no failure injection noise. */
export function getRecentOrders(limit = 8): Promise<Order[]> {
  return call(() => db().orders.filter((o) => o.status !== "pending").slice(0, limit), { fast: true });
}

export function getOrder(id: string): Promise<Order> {
  return call(() => db().orders.find((o) => o.id === id || o.number === id) ?? notFound("Order"));
}

export function refundOrder(id: string, reason: string): Promise<Order> {
  return call(() => {
    const d = db();
    const o = d.orders.find((x) => x.id === id) ?? notFound("Order");
    if (o.status !== "paid" && o.status !== "refund_requested") {
      throw new ApiError("Only paid orders can be refunded.", "conflict");
    }
    commit(() => {
      o.status = "refunded";
      o.refundedAt = new Date().toISOString();
      o.refundReason = reason || o.refundReason || "Refunded by creator";
      const p = d.products.find((x) => x.id === o.productId);
      if (p) {
        p.salesCount = Math.max(0, p.salesCount - 1);
        p.revenue = { ...p.revenue, amount: p.revenue.amount - o.total.amount };
      }
    });
    return o;
  });
}

export function resendReceipt(id: string): Promise<void> {
  return call(() => {
    if (!db().orders.some((x) => x.id === id)) notFound("Order");
  });
}

export interface CustomerQuery {
  search?: string;
  country?: string;
}

export function getCustomers(q: CustomerQuery = {}): Promise<Customer[]> {
  return call(() => {
    const s = q.search?.trim().toLowerCase();
    return db()
      .customers.filter(
        (c) =>
          (!s || c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s)) &&
          (!q.country || q.country === "all" || c.countryCode === q.country)
      )
      .sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
  });
}

export function getCustomer(id: string): Promise<{ customer: Customer; orders: Order[] }> {
  return call(() => {
    const d = db();
    const customer = d.customers.find((c) => c.id === id) ?? notFound("Customer");
    return { customer, orders: d.orders.filter((o) => o.customerId === id) };
  });
}
