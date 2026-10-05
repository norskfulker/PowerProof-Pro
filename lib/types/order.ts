import type { CurrencyCode, ISODate, Money } from "./money";

export type OrderStatus = "pending" | "paid" | "refund_requested" | "refunded" | "failed";

export interface OrderFees {
  gateway: Money;
  platform: Money;
}

export interface Order {
  id: string;
  number: string;
  productId: string;
  productTitle: string;
  customerId: string;
  buyerName: string;
  buyerEmail: string;
  country: string;
  countryCode: string;
  /** What the buyer saw and paid. */
  buyerTotal: Money;
  /** Settled amount in the store currency. */
  total: Money;
  fees: OrderFees;
  net: Money;
  status: OrderStatus;
  source: TrafficSource;
  downloads: number;
  invoiceNumber?: string;
  paymentMethod: "upi" | "card" | "netbanking" | "wallet";
  createdAt: ISODate;
  paidAt?: ISODate;
  refundedAt?: ISODate;
  refundReason?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
  countryCode: string;
  currency: CurrencyCode;
  ordersCount: number;
  totalSpent: Money;
  firstOrderAt: ISODate;
  lastOrderAt: ISODate;
}

export type TrafficSource = "instagram" | "direct" | "google" | "youtube" | "twitter" | "newsletter";
