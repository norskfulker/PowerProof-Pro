"use client";

import { Timer } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { unpaidCountdown, unpaidDeadline } from "@/lib/payment-events";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * For an online order still waiting for payment: how long until it's cancelled automatically
 * (an hour after it was created). Nothing for paid, cash-on-delivery or finished orders.
 */
export function UnpaidTimer({ order, className }: { order: Pick<Order, "status" | "payment" | "createdAt">; className?: string }) {
  const now = useNow();
  const deadline = unpaidDeadline({ status: order.status, paymentMethod: order.payment, createdAt: order.createdAt });
  if (deadline === undefined || now === null) return null;
  const late = deadline <= now;
  return (
    <span title="Online orders not paid within an hour are cancelled automatically" className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap", late ? "bg-muted text-muted-foreground" : "bg-warning-soft text-warning-ink", className)}>
      <Timer className="size-3" aria-hidden />
      {unpaidCountdown(deadline, now)}
    </span>
  );
}
