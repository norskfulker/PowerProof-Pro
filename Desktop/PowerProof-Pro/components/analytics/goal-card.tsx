"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/pp/currency-input";
import { MoneyText } from "@/components/pp/money-text";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getGoalProgress, setRevenueGoal } from "@/lib/api";
import type { Money } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Set or change the goal, in a small panel */
function GoalEditor({ goal, currency, onSaved, label }: { goal?: Money; currency: Money["currency"]; onSaved: () => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Money | undefined>(goal);
  const save = async (amount?: number) => {
    try {
      await setRevenueGoal(amount);
      toast.success(amount ? "Goal saved" : "Goal removed");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The goal didn't save.");
    }
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(goal); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={goal ? "ghost" : "secondary"}>{label}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void save(value?.amount); }}>
          <label className="text-sm font-medium" htmlFor="goal-amount">Revenue goal each month</label>
          <CurrencyInput id="goal-amount" value={value} onChange={setValue} currency={currency} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!value?.amount}>Save</Button>
            {goal && <Button type="button" size="sm" variant="ghost" onClick={() => void save(undefined)}>Remove goal</Button>}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/**
 * This month against the store's revenue goal: how far along, and what each remaining day needs.
 * `quiet` (the dashboard): nothing at all until a goal is set.
 */
export function GoalCard({ quiet = false, className }: { quiet?: boolean; className?: string }) {
  const { data, reload } = useApi(getGoalProgress, [], { live: true });
  if (!data) return quiet ? null : <Skeleton className={cn("h-24 rounded-card", className)} />;
  if (!data.goal) {
    if (quiet) return null;
    return (
      <section className={cn("flex flex-wrap items-center gap-3 rounded-card border border-dashed bg-surface px-5 py-4", className)} aria-label="Monthly goal">
        <Target className="size-5 text-primary" aria-hidden />
        <p className="flex-1 text-sm"><span className="font-medium">Set a monthly revenue goal</span> <span className="text-muted-foreground">and see each day what you need to reach it.</span></p>
        <GoalEditor currency={data.sold.currency} onSaved={reload} label="Set a goal" />
      </section>
    );
  }
  const share = Math.min(100, (data.sold.amount / data.goal.amount) * 100);
  const done = data.sold.amount >= data.goal.amount;
  return (
    <section className={cn("flex flex-col gap-3 rounded-card border bg-surface px-5 py-4", className)} aria-label="Monthly goal">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <MoneyText value={data.sold} className="font-display text-xl font-bold" /> <span className="text-muted-foreground">of <MoneyText value={data.goal} /> this month</span>
        </p>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm", done ? "font-semibold text-success" : "text-muted-foreground")}>
            {done ? "Goal reached" : data.perDay ? <><MoneyText value={data.perDay} /> a day for {data.daysLeft} day{data.daysLeft === 1 ? "" : "s"}</> : null}
          </span>
          <GoalEditor goal={data.goal} currency={data.goal.currency} onSaved={reload} label="Change" />
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Monthly goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share)}>
        <div className={cn("h-full rounded-full", done ? "bg-success" : "bg-primary")} style={{ width: `${share}%` }} />
      </div>
    </section>
  );
}
