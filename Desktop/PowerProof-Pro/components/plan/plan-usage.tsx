"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlan } from "./plan-context";
import type { PlanState } from "@/lib/api";

type Limited = { label: string; used: number; max: number };

/** The Free limits in use, fullest first (Pro has none) */
export function limitsInUse(state: PlanState): Limited[] {
  const all: { label: string; used: number; max: number | null }[] = [
    { label: "products", used: state.usage.products, max: state.limits.products },
    { label: "pages", used: state.usage.pages, max: state.limits.pages },
    { label: "stores", used: state.usage.stores, max: state.limits.stores },
  ];
  return all.filter((l): l is Limited => l.max !== null).sort((a, b) => b.used / b.max - a.used / a.max);
}

/** One limit as a thin bar with "8 of 10 products" */
export function Meter({ label, used, max }: Limited) {
  const full = used >= max;
  return (
    <div className="flex flex-col gap-1">
      <span className={cn("text-xs", full ? "font-semibold text-warning-ink" : "text-muted-foreground")}>
        {used} of {max} {label}
      </span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(used, max)} aria-valuetext={`${used} of ${max}`}>
        <div className={cn("h-full rounded-full", full ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, (used / max) * 100)}%` }} />
      </div>
    </div>
  );
}

/**
 * The plan in one glance. `nudge` (the sidebar): only on Free, and only once a limit is 80% used,
 * as that one limit and Upgrade. Otherwise (the account menu): the plan's name, and on Free the
 * fullest limit.
 */
export function PlanUsage({ nudge = false, className }: { nudge?: boolean; className?: string }) {
  const { state, upgrade } = usePlan();
  if (!state) return null;
  const free = state.tier === "free";
  const top = free ? limitsInUse(state)[0] : undefined;
  if (nudge && (!top || top.used / top.max < 0.8)) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!nudge && <p className="text-xs font-semibold">{free ? "Free plan" : "Pro plan"}</p>}
      {top && <Meter {...top} />}
      {free && (
        <Button size="sm" variant="brass" onClick={() => upgrade()}>
          <Sparkles aria-hidden /> Upgrade to Pro
        </Button>
      )}
    </div>
  );
}
