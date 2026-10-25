import "server-only";
import { UNPAID_TIMEOUT_MS } from "../payment-events";
import { sbAdmin } from "../supabase/admin";
import { fetchGatewayOrder, fetchOrderPayments, razorpayConfig } from "./razorpay";
import { completePayment, mailOrderCancelled } from "./shop";

/**
 * The unpaid-order timeout, run by the cron (app/api/cron/unpaid, every few minutes). An online
 * order still unpaid an hour after it was created is cancelled, but first Razorpay is asked whether
 * it was paid (a webhook can be late or lost): if it was, the payment is applied instead.
 * When Razorpay can't be reached, the order waits for the next run rather than being cancelled on a
 * guess; after a day it's cancelled anyway. cancel_unpaid_order() locks the row and only cancels
 * pending or failed orders, so overlapping runs and a payment landing mid-run are safe.
 */

const BATCH = 100;
const GIVE_UP_CHECKING_MS = 24 * 60 * 60 * 1000;

export interface UnpaidRun {
  checked: number;
  cancelled: number;
  reconciled: number;
  waiting: number;
}

export async function cancelUnpaidOrders(now = Date.now()): Promise<UnpaidRun> {
  const db = sbAdmin();
  const { data, error } = await db
    .from("orders")
    .select("id, store_id, gateway, gateway_order_id, created_at")
    .in("status", ["pending", "failed"])
    .eq("payment_method", "online")
    .lt("created_at", new Date(now - UNPAID_TIMEOUT_MS).toISOString())
    .order("created_at")
    .limit(BATCH);
  if (error) throw new Error(error.message);
  const cfg = razorpayConfig();
  const run: UnpaidRun = { checked: data?.length ?? 0, cancelled: 0, reconciled: 0, waiting: 0 };

  for (const o of data ?? []) {
    // PowerProof's own Razorpay account: ask it before cancelling
    if ((o.gateway ?? "razorpay") === "razorpay" && o.gateway_order_id && !o.gateway_order_id.startsWith("free_")) {
      if (!cfg) {
        run.waiting++;
        continue;
      }
      try {
        const rz = await fetchGatewayOrder(cfg, o.gateway_order_id);
        if (rz.status === "paid" || rz.amount_paid >= rz.amount) {
          const paid = (await fetchOrderPayments(cfg, o.gateway_order_id)).items.find((p) => p.status === "captured");
          if (paid) {
            // Records the payment event too, under the same id the webhook would use
            await completePayment(o.gateway_order_id, paid.id, paid.fee);
            run.reconciled++;
            continue;
          }
        }
      } catch (e) {
        // Can't tell whether it was paid: try again next run, unless it's been a day
        console.error("[unpaid] couldn't check", o.gateway_order_id, e instanceof Error ? e.message : e);
        if (now - Date.parse(o.created_at) < GIVE_UP_CHECKING_MS) {
          run.waiting++;
          continue;
        }
      }
    }
    const r = await db.rpc("cancel_unpaid_order" as never, { p_order: o.id } as never);
    if (r.error) {
      console.error("[unpaid] cancel failed", o.id, r.error.message);
      continue;
    }
    if (r.data === true) {
      run.cancelled++;
      // A checkout left days ago (a backlog the first run clears) gets no email: it would only confuse
      if (now - Date.parse(o.created_at) < GIVE_UP_CHECKING_MS) await mailOrderCancelled(o.id).catch((e) => console.error("[mail] order-cancelled email", e instanceof Error ? e.message : e));
    }
  }
  return run;
}
