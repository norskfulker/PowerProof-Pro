import "server-only";
import { CREDIT_PRICE, creditsCostMinor } from "@/lib/agents/define";
import { createGatewayOrder, fetchGatewayOrder, razorpayConfig, verifyPaymentSignature, type RazorpayConfig } from "@/lib/server/razorpay";
import { AgentError, audit } from "./access";
import { agentsAdmin, must } from "./db";

/**
 * Buying agent credits: any number, at one flat price per credit (CREDIT_PRICE). The browser asks
 * for an order, pays it in Razorpay's window, then brings back the signature; only then are the
 * credits added, once per payment. The amount and the store come from the order Razorpay holds,
 * never from the browser, so a tampered request can't buy credits cheaper or for someone else.
 */

const needCfg = (): RazorpayConfig => {
  const cfg = razorpayConfig();
  if (!cfg) throw new AgentError("Buying credits isn't connected yet. Set the Razorpay keys first.", 503);
  return cfg;
};

export function checkCredits(n: number): number {
  if (!Number.isInteger(n) || n < CREDIT_PRICE.min || n > CREDIT_PRICE.max) throw new AgentError(`Pick between ${CREDIT_PRICE.min} and ${CREDIT_PRICE.max.toLocaleString("en-US")} credits.`);
  return n;
}

export async function startCreditPurchase(storeId: string, userId: string, credits: number): Promise<{ keyId: string; orderId: string; amountMinor: number; currency: string }> {
  const cfg = needCfg();
  const n = checkCredits(credits);
  const amount = creditsCostMinor(n);
  const order = await createGatewayOrder(cfg, {
    amount,
    currency: CREDIT_PRICE.currency,
    receipt: `cr_${Date.now().toString(36)}_${storeId.slice(0, 8)}`,
    notes: { purpose: "agent_credits", store_id: storeId, credits: String(n), user_id: userId },
  });
  return { keyId: cfg.keyId, orderId: order.id, amountMinor: amount, currency: CREDIT_PRICE.currency };
}

/** Adds the credits a paid order bought. Safe to call twice: the payment id is the ledger key. */
export async function confirmCreditPurchase(storeId: string, userId: string, p: { orderId: string; paymentId: string; signature: string }): Promise<{ credits: number }> {
  const cfg = needCfg();
  if (!verifyPaymentSignature(p.orderId, p.paymentId, p.signature, cfg.keySecret)) throw new AgentError("That payment couldn't be confirmed.", 400);
  const order = await fetchGatewayOrder(cfg, p.orderId);
  const notes = Array.isArray(order.notes) ? {} : order.notes;
  const n = Number(notes.credits);
  if (notes.purpose !== "agent_credits" || notes.store_id !== storeId || !Number.isInteger(n)) throw new AgentError("That payment isn't for this store's credits.", 400);
  if (order.amount !== creditsCostMinor(n) || order.currency !== CREDIT_PRICE.currency) throw new AgentError("That payment doesn't match the price.", 400);

  const sb = agentsAdmin();
  must(
    await sb
      .from("agent_credit_ledger")
      .upsert(
        { store_id: storeId, delta: n, kind: "topup", reason: `Bought ${n} credits`, idempotency_key: `topup:${p.paymentId}`, ref: p.orderId, created_by: userId },
        { onConflict: "idempotency_key", ignoreDuplicates: true }
      ),
    "add credits"
  );
  await audit(userId, "agents_credits_bought", { type: "store", id: storeId }, { credits: n, amountMinor: order.amount, orderId: p.orderId, paymentId: p.paymentId });
  return { credits: n };
}
