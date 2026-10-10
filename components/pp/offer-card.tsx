"use client";

import { Copy, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { Coupon } from "@/lib/types";
import { copyText } from "./copy-field";

export function couponLabel(c: Coupon): string {
  return c.kind === "percent" ? `${c.value}% off` : `${formatMoney({ amount: c.value, currency: "INR" })} off`;
}

/** Coupon card with a copy button. Codes are applied at checkout. */
export function OfferCard({ coupon }: { coupon: Coupon }) {
  return (
    <div className="relative flex items-stretch overflow-hidden rounded-card border bg-surface">
      <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-border-strong bg-accent-soft p-3 text-accent-ink">
        <Ticket className="size-5" aria-hidden />
        <span className="text-center font-display text-lg leading-tight">{couponLabel(coupon)}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <p className="text-sm">
          {coupon.scope === "store" ? "On everything" : "On selected products"}
          {coupon.minSpend ? ` over ${formatMoney(coupon.minSpend)}` : ""}
          {coupon.expiresAt ? `. Ends ${formatDate(coupon.expiresAt)}.` : "."}
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-control border border-dashed border-border-strong px-3 py-1.5 font-mono text-sm font-semibold tracking-wider">{coupon.code}</span>
          <Button variant="ghost" size="sm" onClick={() => copyText(coupon.code, `${coupon.code} copied. Paste it at checkout.`)} aria-label={`Copy code ${coupon.code}`}>
            <Copy aria-hidden /> Copy
          </Button>
        </div>
      </div>
    </div>
  );
}
