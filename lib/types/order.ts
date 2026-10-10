import type { CurrencyCode, ISODate, Money } from "./money";

export type OrderStatus = "pending" | "cod" | "paid" | "refund_requested" | "refunded" | "failed";

/** Where a shipped order is. Absent for orders with nothing to ship. */
export type FulfilmentStatus = "unfulfilled" | "shipped" | "delivered" | "cancelled";

export interface ShipAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  pincode: string;
  country: string;
}

export interface OrderFees {
  gateway: Money;
  platform: Money;
}

export interface OrderItem {
  productId: string;
  title: string;
  /** Store currency (INR). What the buyer pays for this line after deal paths, before any coupon. */
  price: Money;
  /** "deal": added from the deal paths panel, or a free gift */
  kind: "product" | "bundle" | "bump" | "deal";
  /** Price before deal paths. Absent when no deal touched the line. */
  basePrice?: Money;
  /** Free because of a deal (gift or cheapest-free) */
  free?: boolean;
  /** A gift added by a deal rule, not chosen by the buyer */
  gift?: boolean;
  /** Deal rules that changed this line */
  ruleIds?: string[];
  quantity?: number;
  /** "M / Blue" */
  variant?: string;
  physical?: boolean;
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
  /** Not tracked yet: unset until visits are recorded */
  source?: TrafficSource;
  /** Not tracked yet */
  downloads?: number;
  invoiceNumber?: string;
  paymentMethod?: "upi" | "card" | "netbanking" | "wallet";
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
  /** Products the buyer added from the deal paths panel */
  dealAdds?: string[];
  /** choose_gift rule id → chosen product id */
  giftChoices?: Record<string, string>;
  /** Buyer closed the deals panel */
  dealsSkipped?: boolean;
  /** Deal rules applied to this order, and what they saved (store currency) */
  dealRuleIds?: string[];
  dealSaving?: Money;
  reviewed?: boolean;
  /** Paid online, or cash on delivery */
  payment?: "online" | "cod";
  /** Physical orders: what shipping and the COD charge added */
  shipping?: Money;
  codFee?: Money;
  shipTo?: ShipAddress;
  fulfilment?: FulfilmentStatus;
  tracking?: { carrier?: string; number?: string; url?: string };
  shippedAt?: ISODate;
  deliveredAt?: ISODate;
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

export type TrafficSource = "instagram" | "direct" | "google" | "youtube" | "twitter" | "newsletter" | "facebook" | "linkedin" | "whatsapp" | "other";
