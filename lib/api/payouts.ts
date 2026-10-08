import type { CryptoAsset, CryptoNetwork } from "../india";
import type { Balance, Money, Payout, PayoutMethod } from "../types";
import { liveChange } from "./live/notify";
import * as live from "./live/money";

export const MIN_WITHDRAWAL = 100_00; // ₹100.00

export interface BankInput {
  holderName: string;
  accountNumber: string;
  ifsc: string;
}

export interface CryptoInput {
  asset: CryptoAsset;
  network: CryptoNetwork;
  address: string;
}

export const getBalance = (): Promise<Balance> => live.getBalance();
export const getPayouts = (): Promise<Payout[]> => live.getPayouts();
export const getPayout = (id: string): Promise<Payout> => live.getPayout(id);
export const getPayoutMethods = (): Promise<PayoutMethod[]> => live.getPayoutMethods();
export const addBankAccount = (input: BankInput): Promise<PayoutMethod> => liveChange(live.addBankAccount(input));
export const requestPayout = (amount: Money, methodId: string): Promise<Payout> => liveChange(live.requestPayout(amount, methodId));
export const addCryptoWallet = (input: CryptoInput): Promise<PayoutMethod> => liveChange(live.addCryptoWallet(input));
export const setPrimaryMethod = (id: string): Promise<void> => liveChange(live.setPrimaryMethod(id));
export const removePayoutMethod = (id: string): Promise<void> => liveChange(live.removePayoutMethod(id));
