import { sb } from "../../supabase/browser";
import type { Balance, Money, Payout, PayoutMethod } from "../../types";
import { ApiError } from "../client";
import type { BankInput } from "../payouts";
import { fail, must } from "./errors";
import { currency, money, payoutFrom, payoutMethodFrom } from "./map";
import { activeStoreId, currentUser } from "./session";

/**
 * Balance, payouts and payout methods. The balance is the database's own sum of the ledger
 * (creator_balances): sales are held 3 hours, then available.
 */

const METHOD_COLS = "id, owner_id, kind, holder_name, bank_name, ifsc, account_last4, upi_masked, is_default, verified_at, created_at, updated_at";

async function storeCurrency(storeId: string) {
  const { data } = await sb().from("stores").select("currency_base").eq("id", storeId).single();
  return currency(data?.currency_base);
}

export async function getBalance(): Promise<Balance> {
  const storeId = await activeStoreId();
  const cur = await storeCurrency(storeId);
  const [bal, next, paid] = await Promise.all([
    sb().from("creator_balances").select("available_minor, pending_minor, currency").eq("store_id", storeId).eq("currency", cur).maybeSingle(),
    sb().from("ledger_entries").select("available_at").eq("store_id", storeId).eq("account", "creator").gt("available_at", new Date().toISOString()).order("available_at").limit(1),
    sb().from("payouts").select("amount_minor").eq("store_id", storeId).eq("status", "paid"),
  ]);
  if (bal.error) fail(bal.error);
  return {
    available: money(Math.max(0, Number(bal.data?.available_minor ?? 0)), cur),
    pending: money(Math.max(0, Number(bal.data?.pending_minor ?? 0)), cur),
    nextReleaseAt: next.data?.[0]?.available_at ?? undefined,
    lifetimePaidOut: money((paid.data ?? []).reduce((t, p) => t + Number(p.amount_minor), 0), cur),
  };
}

export async function getPayoutMethods(): Promise<PayoutMethod[]> {
  const me = await currentUser();
  const rows = must(await sb().from("payout_methods").select(METHOD_COLS).eq("owner_id", me.id).order("is_default", { ascending: false }).order("created_at"));
  return rows.map(payoutMethodFrom);
}

export async function getPayouts(): Promise<Payout[]> {
  const storeId = await activeStoreId();
  const [rows, methods] = await Promise.all([sb().from("payouts").select("*").eq("store_id", storeId).order("requested_at", { ascending: false }), getPayoutMethods()]);
  return must(rows).map((r) => payoutFrom(r, methods));
}

export async function getPayout(id: string): Promise<Payout> {
  const [row, methods] = await Promise.all([sb().from("payouts").select("*").eq("id", id).single(), getPayoutMethods()]);
  return payoutFrom(must(row, { notFound: "Payout" }), methods);
}

const BANKS: Record<string, string> = { HDFC: "HDFC Bank", ICIC: "ICICI Bank", SBIN: "State Bank of India", UTIB: "Axis Bank", KKBK: "Kotak Mahindra Bank", YESB: "Yes Bank" };

/**
 * Saves a bank account with masked details only: the last 4 digits, IFSC and holder name. The full
 * account number never leaves this function. (Stage 5 sends it to the payment gateway, server
 * side, to create the payout account.)
 */
export async function addBankAccount(input: BankInput): Promise<PayoutMethod> {
  const digits = input.accountNumber.replace(/\s/g, "");
  if (!/^\d{9,18}$/.test(digits)) throw new ApiError("Account numbers are 9 to 18 digits.", "validation");
  const ifsc = input.ifsc.trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new ApiError("IFSC codes look like HDFC0001234.", "validation");
  const me = await currentUser();
  await sb().from("payout_methods").update({ is_default: false }).eq("owner_id", me.id);
  const r = await sb()
    .from("payout_methods")
    .insert({ kind: "bank", holder_name: input.holderName.trim().slice(0, 100), bank_name: BANKS[ifsc.slice(0, 4)] ?? "Bank account", ifsc, account_last4: digits.slice(-4), is_default: true } as never)
    .select(METHOD_COLS)
    .single();
  if (r.error) fail(r.error);
  return payoutMethodFrom(r.data);
}

export async function requestPayout(amount: Money, methodId: string): Promise<Payout> {
  void amount;
  void methodId;
  throw new ApiError("Withdrawals open once payouts are connected. Your balance is safe and keeps adding up.", "validation");
}
