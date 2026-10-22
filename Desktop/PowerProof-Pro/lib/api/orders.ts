import type { Customer, Order, OrderEvent, OrderStatus } from "../types";
import { ApiError } from "./client";
import * as live from "./live/orders";
import { liveChange } from "./live/notify";
import { activeStoreId } from "./live/session";

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
/** Refund an order: all of what's left, or `amount` (minor units) of it */
export const refundOrder = (id: string, reason: string, amount?: number): Promise<Order> => liveChange(call(`/api/orders/${id}/refund`, { reason, amount }).then(() => live.getOrder(id)));
export const getOrderEvents = (order: Pick<Order, "id" | "total">): Promise<OrderEvent[]> => live.getOrderEvents(order.id, order.total.currency);
export const addOrderNote = (order: Pick<Order, "id" | "total">, body: string): Promise<OrderEvent> => live.addOrderNote(order.id, body, order.total.currency);
export const getOrderViews = (ids: string[]) => live.getOrderViews(ids);
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

/* Customers: notes, tags, saved views, emails -------------------------------------- */
export { saveCustomerProfile, tagCustomers, getSegments, saveSegment, deleteSegment, getEmailSends } from "./live/customers";

/** Email customers from the store (sent by the server, with an unsubscribe link). Returns how many it went to. */
export async function emailCustomers(input: { emails: string[]; subject: string; body: string }): Promise<{ sent: number; skipped: number }> {
  const storeId = await activeStoreId();
  const res = await fetch("/api/customers/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, storeId }) });
  const out = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; message?: string; sent?: number; skipped?: number };
  if (!out.ok) throw new ApiError(out.message ?? "The email didn't go out. Try again.", "validation");
  return { sent: out.sent ?? 0, skipped: out.skipped ?? 0 };
}
