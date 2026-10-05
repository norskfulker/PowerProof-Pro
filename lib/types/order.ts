import type { CurrencyCode, ISODate, Money } from "./money";

export type OrderStatus = "pending" | "paid" | "refund_requested" | "refunded" | "failed";

export interface OrderFees {
  gateway: Money;
  platform: Money;
}

export interface OrderItem {
  productId: string;
  title: string;
  /** Store currency (INR) */
  price: Money;
  kind: "product" | "bundle" | "bump";
}

export interface Order {
  id: string;
  /** Secure token for /order/[token]; sent by email. */
  token: string;
  storeId: string;
  number: string;
  productId: string;
  productTitle: string;
  customerId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
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
  /** Everything in the order. The first item mirrors productId/productTitle. */
  items: OrderItem[];
  bundleId?: string;
  couponCode?: string;
  /** Coupon discount in store currency */
  discount?: Money;
  reviewed?: boolean;
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
