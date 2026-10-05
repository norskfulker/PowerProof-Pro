"use client";

import { useApi } from "@/hooks/use-api";
import { getOrders, getPayouts, getStore } from "@/lib/api";
import type { EmailContext } from "./email-registry";

/** Real mock data for the previews: the store, the chosen (or latest) paid order, the latest payout. */
export function useEmailContext(orderId?: string | null) {
  const store = useApi(getStore, []);
  const orders = useApi(() => getOrders({ status: "paid" }), []);
  const payouts = useApi(getPayouts, []);
  const error = store.error ?? orders.error ?? payouts.error;
  const ready = store.data && orders.data && payouts.data;
  let ctx: EmailContext | undefined;
  if (ready) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    ctx = {
      store: store.data!,
      order: orders.data!.find((o) => o.id === orderId) ?? orders.data![0],
      payout: payouts.data![0],
      todayOrders: orders.data!.filter((o) => Date.parse(o.createdAt) >= start.getTime()),
      origin: typeof window === "undefined" ? "" : window.location.origin,
    };
  }
  return { ctx, error, retry: () => { store.reload(); orders.reload(); payouts.reload(); } };
}
