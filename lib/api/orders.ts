import type { Customer, Order, OrderStatus } from "../types";
import * as live from "./live/orders";

export interface OrderQuery {
  search?: string;
  status?: OrderStatus | "all";
  productId?: string;
  customerId?: string;
  /** Only orders with an open dispute (Sales › Orders › Disputed) */
  disputed?: boolean;
  limit?: number;
}

export interface CustomerQuery {
  search?: string;
  country?: string;
}

export const getOrders = (q: OrderQuery = {}): Promise<Order[]> => live.getOrders(q);
export const getRecentOrders = (limit = 8): Promise<Order[]> => live.getRecentOrders(limit);
export const getOrder = (id: string): Promise<Order> => live.getOrder(id);
/** Refunds and receipts need the payment gateway and email sending; the screens say "coming soon". */
export const refundOrder = (_id: string, _reason: string): Promise<Order> => live.refundOrder();
export const resendReceipt = (_id: string): Promise<void> => live.resendReceipt();
export const getCustomers = (q: CustomerQuery = {}): Promise<Customer[]> => live.getCustomers(q);
export const getCustomer = (id: string): Promise<{ customer: Customer; orders: Order[] }> => live.getCustomer(id);
