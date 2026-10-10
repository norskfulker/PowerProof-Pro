"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Money } from "@/lib/types";
import { CHECKOUT_FORM_ID, PayLabel } from "./checkout-form";
import { MoneyText } from "./money-text";

/**
 * Phones only: the total and the Pay button pinned to the bottom of the screen. It submits the
 * checkout form by id, so validation and focus-the-first-error behave exactly like the inline button.
 * Pages using it add bottom padding (pb-28 max-lg) so nothing sits underneath.
 */
export function MobilePayBar({ total, pending, savings, preview }: { total: Money; pending?: boolean; savings?: Money; /** Render in place (design reference) instead of fixed to the screen */ preview?: boolean }) {
  return (
    <div className={cn("border-t bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur", preview ? "rounded-card border" : "fixed inset-x-0 bottom-0 z-40 lg:hidden")}>
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="truncate font-display text-lg font-extrabold tabular" aria-live="polite">
            <MoneyText value={total} />
          </p>
          {/* Always takes its line, so the bar (and the Pay button) never changes height */}
          <p className="truncate text-xs font-semibold text-success" aria-hidden={!savings || savings.amount <= 0 || undefined}>
            {savings && savings.amount > 0 ? (
              <>
                You save <MoneyText value={savings} />
              </>
            ) : (
              " "
            )}
          </p>
        </div>
        <Button type="submit" form={CHECKOUT_FORM_ID} size="lg" disabled={pending} className="shrink-0">
          <PayLabel total={total} pending={pending} />
        </Button>
      </div>
    </div>
  );
}
