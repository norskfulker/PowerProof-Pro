"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { planComparison, type AllPlanLimits } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { usePlan } from "./plan-context";

function Meter({ label, used, max }: { label: string; used: number; max: number | null }) {
  const full = max !== null && used >= max;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span>{label}</span>
        <span className={cn("font-mono", full && "font-semibold text-warning-ink")}>{max === null ? `${used}` : `${used} of ${max}`}</span>
      </div>
      {max !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(used, max)} aria-valuetext={`${used} of ${max}`}>
          <div className={cn("h-full rounded-full", full ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, (used / max) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/** "Stores 1 of 1, Products 0 of 1" with an Upgrade button on Free; a short line on Pro. */
export function PlanUsage({ tone = "light", className }: { tone?: "light" | "card"; className?: string }) {
  const { state, upgrade } = usePlan();
  if (!state) return null;
  const free = state.tier === "free";
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-card border bg-surface p-3", tone === "card" && "p-4", className)}>
      <p className="flex items-center justify-between text-xs font-semibold">
        <span>{free ? "Free plan" : "Pro plan"}</span>
        {!free && <span className="font-normal text-muted-foreground">No limits</span>}
      </p>
      <Meter label="Stores" used={state.usage.stores} max={state.limits.stores} />
      <Meter label="Products" used={state.usage.products} max={state.limits.products} />
      {free && (
        <Button size="sm" variant="brass" onClick={() => upgrade()}>
          <Sparkles aria-hidden /> Upgrade to Pro
        </Button>
      )}
    </div>
  );
}

/** Free vs Pro, for /pricing and /settings/billing. */
export function PlanComparisonTable({ current, limits }: { current?: "free" | "pro"; limits?: AllPlanLimits }) {
  const ctx = usePlan();
  const l = limits ?? ctx.limits;
  return (
    <Table className="min-w-[30rem]">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">What you get</TableHead>
          <TableHead scope="col">Free{current === "free" ? " (yours)" : ""}</TableHead>
          <TableHead scope="col">Pro{current === "pro" ? " (yours)" : ""}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(l ? planComparison(l) : []).map((r) => (
          <TableRow key={r.feature}>
            <TableHead scope="row" className="font-medium text-foreground">{r.feature}</TableHead>
            <TableCell>{r.free}</TableCell>
            <TableCell className="font-medium">{r.pro}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
