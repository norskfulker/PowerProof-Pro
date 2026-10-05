import type { ISODate, Money } from "./money";

export type PayoutStatus = "processing" | "paid" | "failed";

export interface PayoutMethod {
  id: string;
  kind: "bank" | "usdt";
  label: string;
  /** Masked, e.g. ····4821 */
  last4: string;
  holderName: string;
  ifsc?: string;
  bankName?: string;
  verified: boolean;
  primary: boolean;
  comingSoon?: boolean;
}

export interface Payout {
  id: string;
  amount: Money;
  status: PayoutStatus;
  methodId: string;
  methodLabel: string;
  reference?: string;
  createdAt: ISODate;
  arrivedAt?: ISODate;
  failureReason?: string;
}

export interface Balance {
  available: Money;
  pending: Money;
  /** When the oldest pending money becomes available. */
  nextReleaseAt?: ISODate;
  lifetimePaidOut: Money;
}
