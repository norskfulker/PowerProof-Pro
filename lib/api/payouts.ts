import type { Balance, Money, Payout, PayoutMethod } from "../types";
import { liveChange } from "./live/notify";
import * as live from "./live/money";

export const MIN_WITHDRAWAL = 100_00; // ₹100.00

export interface BankInput {
  holderName: string;
  accountNumber: string;
  ifsc: string;
}

/** USDT is shown as a labelled "coming soon" option; it can't be chosen. */
export function usdtPlaceholder(): PayoutMethod {
  return { id: "pm_usdt", kind: "usdt", label: "USDT (TRC-20)", last4: "", holderName: "", verified: false, primary: false, comingSoon: true };
}

export const getBalance = (): Promise<Balance> => live.getBalance();
export const getPayouts = (): Promise<Payout[]> => live.getPayouts();
export const getPayout = (id: string): Promise<Payout> => live.getPayout(id);
export const getPayoutMethods = (): Promise<PayoutMethod[]> => live.getPayoutMethods().then((m) => [...m, usdtPlaceholder()]);
export const addBankAccount = (input: BankInput): Promise<PayoutMethod> => liveChange(live.addBankAccount(input));
export const requestPayout = (amount: Money, methodId: string): Promise<Payout> => liveChange(live.requestPayout(amount, methodId));
