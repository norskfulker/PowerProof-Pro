import type { ISODate, Money } from "./money";

export interface AdminCreator {
  id: string;
  storeName: string;
  slug: string;
  ownerName: string;
  email: string;
  city: string;
  plan: "trial" | "active" | "past_due" | "suspended";
  gmv30d: Money;
  orders30d: number;
  kyc: "verified" | "pending" | "rejected";
  joinedAt: ISODate;
  risk: "low" | "medium" | "high";
}

export interface Dispute {
  id: string;
  orderNumber: string;
  storeName: string;
  buyerEmail: string;
  amount: Money;
  reason: "not_received" | "not_as_described" | "fraud" | "duplicate";
  status: "open" | "won" | "lost" | "under_review";
  dueBy: ISODate;
  openedAt: ISODate;
}

export interface AdminPayout {
  id: string;
  storeName: string;
  amount: Money;
  method: string;
  status: "queued" | "on_hold" | "sent" | "failed";
  requestedAt: ISODate;
  note?: string;
}

export interface Flag {
  id: string;
  kind: "product" | "page" | "store";
  target: string;
  storeName: string;
  reason: string;
  reporter: string;
  status: "open" | "removed" | "dismissed";
  createdAt: ISODate;
}
