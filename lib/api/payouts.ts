import { money } from "../money";
import { commit, db } from "../mock/db";
import { uid } from "../mock/random";
import { SETTLE_MS, type Db } from "../mock/seed";
import type { Balance, Money, Payout, PayoutMethod } from "../types";
import { ApiError, call, notFound } from "./client";
import { isLive } from "../supabase/env";
import { liveChange } from "./live/notify";
import * as live from "./live/money";

export const MIN_WITHDRAWAL = 100_00; // ₹100.00

export function computeBalance(d: Db, now = Date.now()): Balance {
  let settled = 0;
  let pending = 0;
  let oldestPending: number | undefined;
  for (const o of d.orders) {
    if (o.status !== "paid" && o.status !== "refund_requested") continue;
    const paidAt = o.paidAt ? Date.parse(o.paidAt) : now;
    if (o.status === "paid" && now - paidAt >= SETTLE_MS) settled += o.net.amount;
    else {
      // Refund requests are held until resolved; they don't have a release date.
      pending += o.net.amount;
      if (o.status === "paid") oldestPending = Math.min(oldestPending ?? paidAt, paidAt);
    }
  }
  const since = Date.parse(d.ledger.since);
  const withdrawn = d.payouts
    .filter((p) => p.status !== "failed" && Date.parse(p.createdAt) >= since)
    .reduce((t, p) => t + p.amount.amount, 0);
  return {
    available: money(Math.max(0, d.ledger.opening + settled - withdrawn)),
    pending: money(pending),
    nextReleaseAt: oldestPending ? new Date(oldestPending + SETTLE_MS).toISOString() : undefined,
    lifetimePaidOut: money(d.payouts.filter((p) => p.status === "paid").reduce((t, p) => t + p.amount.amount, 0)),
  };
}

export function getBalance(): Promise<Balance> {
  if (isLive()) return live.getBalance();
  return call(() => computeBalance(db()));
}

export function getPayouts(): Promise<Payout[]> {
  if (isLive()) return live.getPayouts();
  return call(() => [...db().payouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function getPayout(id: string): Promise<Payout> {
  if (isLive()) return live.getPayout(id);
  return call(() => db().payouts.find((p) => p.id === id) ?? notFound("Payout"));
}

export function getPayoutMethods(): Promise<PayoutMethod[]> {
  if (isLive()) return live.getPayoutMethods().then((m) => [...m, usdtPlaceholder()]);
  return call(() => db().payoutMethods);
}

export interface BankInput {
  holderName: string;
  accountNumber: string;
  ifsc: string;
}

export function addBankAccount(input: BankInput): Promise<PayoutMethod> {
  if (isLive()) return liveChange(live.addBankAccount(input));
  return call(() => {
    const method: PayoutMethod = {
      id: uid("pm"),
      kind: "bank",
      label: bankFromIfsc(input.ifsc),
      bankName: bankFromIfsc(input.ifsc),
      last4: input.accountNumber.slice(-4),
      holderName: input.holderName,
      ifsc: input.ifsc.toUpperCase(),
      verified: true, // mock: penny-drop passes instantly
      primary: true,
    };
    commit((d) => {
      d.payoutMethods.forEach((m) => (m.primary = false));
      d.payoutMethods = [method, ...d.payoutMethods.filter((m) => m.kind !== "usdt"), usdtPlaceholder()];
    });
    return method;
  });
}

export function usdtPlaceholder(): PayoutMethod {
  return { id: "pm_usdt", kind: "usdt", label: "USDT (TRC-20)", last4: "", holderName: "", verified: false, primary: false, comingSoon: true };
}

function bankFromIfsc(ifsc: string): string {
  const code = ifsc.slice(0, 4).toUpperCase();
  const map: Record<string, string> = { HDFC: "HDFC Bank", ICIC: "ICICI Bank", SBIN: "State Bank of India", UTIB: "Axis Bank", KKBK: "Kotak Mahindra Bank", YESB: "Yes Bank" };
  return map[code] ?? "Bank account";
}

export function requestPayout(amount: Money, methodId: string): Promise<Payout> {
  if (isLive()) return liveChange(live.requestPayout(amount, methodId));
  return call(() => {
    const d = db();
    const method = d.payoutMethods.find((m) => m.id === methodId) ?? notFound("Payout method");
    if (method.comingSoon) throw new ApiError("USDT payouts aren't live yet. Pick your bank account.", "validation");
    const bal = computeBalance(d);
    if (amount.amount < MIN_WITHDRAWAL) throw new ApiError("The smallest withdrawal is ₹100.00.", "validation");
    if (amount.amount > bal.available.amount) throw new ApiError("That's more than your available balance.", "validation");
    const payout: Payout = {
      id: uid("po"),
      amount,
      status: "processing",
      methodId,
      methodLabel: `${method.label} ····${method.last4}`,
      createdAt: new Date().toISOString(),
    };
    commit((x) => {
      x.payouts.unshift(payout);
      x.notifications.unshift({
        id: uid("n"),
        kind: "payout",
        title: "Payout on its way",
        body: `Usually lands within a few hours.`,
        createdAt: payout.createdAt,
        read: false,
        href: "/sales/payouts/balance",
      });
    });
    return payout;
  });
}
