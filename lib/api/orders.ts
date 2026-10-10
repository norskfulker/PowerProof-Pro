import type { Customer, Order, OrderStatus } from "../types";
import { ApiError } from "./client";
import * as live from "./live/orders";
import { liveChange } from "./live/notify";

export interface OrderQuery {
  search?: string;
  status?: OrderStatus | "all";
  productId?: string;
  customerId?: string;
  /** Only orders with an open dispute (Sales › Orders › Disputed) */
  disputed?: boolean;
  /** Only orders waiting to be shipped */
  toShip?: boolean;
  limit?: number;
}

export interface CustomerQuery {
  search?: string;
  country?: string;
}

export const getOrders = (q: OrderQuery = {}): Promise<Order[]> => live.getOrders(q);
export const getRecentOrders = (limit = 8): Promise<Order[]> => live.getRecentOrders(limit);
export const getOrder = (id: string): Promise<Order> => live.getOrder(id);
/** Refunds go back to the buyer's original payment method; the receipt email needs RESEND_API_KEY and MAIL_FROM. Both run on the server. */
async function call(path: string, body?: unknown): Promise<void> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const out = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; message?: string };
  if (!out.ok) throw new ApiError(out.message ?? "That didn't work. Try again.", res.status === 404 ? "not_found" : "validation");
}
export const refundOrder = (id: string, reason: string): Promise<Order> => liveChange(call(`/api/orders/${id}/refund`, { reason }).then(() => live.getOrder(id)));
export const resendReceipt = (id: string): Promise<void> => call(`/api/orders/${id}/resend`);

/** Ship an order: sent (with tracking), delivered, cash collected, or cancelled (COD). Tells the buyer by email when sent or delivered. */
export interface FulfilInput {
  step: "shipped" | "delivered" | "cod_paid" | "cancelled";
  carrier?: string;
  number?: string;
  url?: string;
  notify?: boolean;
}
export const fulfilOrder = (id: string, input: FulfilInput): Promise<Order> => liveChange(call(`/api/orders/${id}/fulfil`, input).then(() => live.getOrder(id)));
export const getCustomers = (q: CustomerQuery = {}): Promise<Customer[]> => live.getCustomers(q);
export const getCustomer = (id: string): Promise<{ customer: Customer; orders: Order[] }> => live.getCustomer(id);
