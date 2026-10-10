import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GatewayError, createFundAccount, payoutConfig } from "@/lib/server/razorpay";
import { sbAdmin } from "@/lib/supabase/admin";
import { sbServer } from "@/lib/supabase/server";

/**
 * A seller adds a bank account. The full number goes straight to Razorpay (to register the account
 * for automatic payouts) and is never stored here: we keep the last four digits and Razorpay's id.
 * When automatic payouts aren't connected the answer says so and the browser saves the account the
 * old way (last four only), to be paid by hand.
 */
export const dynamic = "force-dynamic";

const BANKS: Record<string, string> = { HDFC: "HDFC Bank", ICIC: "ICICI Bank", SBIN: "State Bank of India", UTIB: "Axis Bank", KKBK: "Kotak Mahindra Bank", PUNB: "Punjab National Bank", BARB: "Bank of Baroda", YESB: "Yes Bank", IDFB: "IDFC First Bank", INDB: "IndusInd Bank" };
const body = z.object({ holderName: z.string().trim().min(2).max(100), accountNumber: z.string().regex(/^\d{9,18}$/), ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/) });

export async function POST(request: Request) {
  const cfg = payoutConfig();
  if (!cfg) return NextResponse.json({ ok: false, code: "not_configured" });
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Check the name, account number and IFSC." }, { status: 400 });
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again to add an account." }, { status: 401 });
  const { holderName, accountNumber, ifsc } = parsed.data;

  // Our own rules first (the holder must match the seller's name; up to 5 accounts), with the seller's own session
  const { count } = await db.from("payout_methods").select("id", { count: "exact", head: true }).eq("owner_id", auth.user.id);
  const probe = await db
    .from("payout_methods")
    .insert({ kind: "bank", holder_name: holderName, bank_name: BANKS[ifsc.slice(0, 4)] ?? "Bank account", ifsc, account_last4: accountNumber.slice(-4), is_default: !count } as never)
    .select("id")
    .single();
  if (probe.error) return NextResponse.json({ ok: false, message: probe.error.message }, { status: 400 });

  try {
    const fund = await createFundAccount(cfg, { name: holderName, email: auth.user.email ?? "seller@powerproof.invalid", reference: auth.user.id, ifsc, accountNumber });
    const { error } = await sbAdmin().from("payout_methods").update({ gateway_fund_account_id: fund.id }).eq("id", probe.data.id);
    if (error) throw new Error("save");
    return NextResponse.json({ ok: true, id: probe.data.id });
  } catch (e) {
    // Razorpay refused (wrong number or IFSC, say): the account isn't kept half-saved
    await db.from("payout_methods").delete().eq("id", probe.data.id);
    const msg = e instanceof GatewayError ? e.message : "We couldn't register that account. Check the details and try again.";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}
