"use client";

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getStorageUsage, getTeam } from "@/lib/api";
import { formatBytes } from "@/lib/money";
import { AI_FREE_MESSAGES } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { PlanComparisonTable } from "./plan-usage";
import { usePlan } from "./plan-context";

type Period = "Total" | "Per store" | "Per month" | "Per day" | "Lifetime";

interface Limit {
  name: string;
  /** What is counted, in a few words */
  counts: string;
  period: Period;
  /** undefined = not measured here */
  used?: number;
  /** null = unlimited; false = not on this plan */
  max: number | null | false;
  /** How to print an amount (bytes for storage) */
  show?: (n: number) => string;
}

function Row({ l }: { l: Limit }) {
  const show = l.show ?? String;
  const metered = typeof l.max === "number" && l.used !== undefined;
  const pct = metered ? Math.min(100, (l.used! / (l.max as number)) * 100) : 0;
  const full = metered && l.used! >= (l.max as number);
  const near = metered && !full && pct >= 80;
  const allowed = l.max === false ? "Not on your plan" : l.max === null ? "Unlimited" : show(l.max);
  return (
    <li className="grid grid-cols-1 gap-x-6 gap-y-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {l.name}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">{l.period}</span>
          {full && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-warning-ink">Limit reached</span>}
          {near && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-warning-ink">Almost full</span>}
        </p>
        <p className="text-sm text-muted-foreground">{l.counts}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-mono font-semibold tabular">{l.used === undefined ? "—" : show(l.used)}</span>
          <span className="text-muted-foreground">of {allowed}</span>
        </p>
        {metered && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-label={l.name} aria-valuemin={0} aria-valuemax={l.max as number} aria-valuenow={Math.min(l.used!, l.max as number)} aria-valuetext={`${show(l.used!)} of ${allowed}`}>
            <div className={cn("h-full rounded-full", full || near ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Billing › Usage and limits: every limit of the plan as its own row, saying what it counts, over
 * what period, how much is used and how much is allowed. The Free vs Pro table sits underneath.
 */
export function UsageLimits() {
  const { state, upgrade } = usePlan();
  const storage = useApi(getStorageUsage, []);
  const team = useApi(getTeam, []);
  if (!state) return <Skeleton className="h-80 rounded-card" />;
  const { limits: lim, usage } = state;
  const free = state.tier === "free";
  const members = team.data?.filter((p) => p.role !== "owner").length;

  const rows: Limit[] = [
    { name: "Stores", counts: "Stores you own, in every workspace", period: "Total", used: usage.stores, max: lim.stores },
    { name: "Products", counts: "Every product in your stores, drafts and archived included", period: "Total", used: usage.products, max: lim.products },
    { name: "Pages", counts: "Pages built in the editor, besides each store's home page", period: "Total", used: usage.pages, max: lim.pages },
    { name: "Team members", counts: "People in this workspace besides you, invites included", period: "Total", used: members, max: lim.teamSeats },
    { name: "Media storage", counts: "Files in this store's media library", period: "Per store", used: storage.data?.used, max: storage.data?.quota ?? null, show: formatBytes },
    { name: "AI image credits", counts: "One credit per image generation of 4 variations", period: "Per month", max: lim.aiCredits },
    free
      ? { name: "AI page builds", counts: "Messages to the AI page builder", period: "Lifetime", max: AI_FREE_MESSAGES }
      : { name: "AI page builds", counts: "Pages the AI builds; a failed build doesn't count", period: "Per day", max: lim.aiPagesDaily },
    { name: "Your own domain", counts: "A domain you own in place of powerproof.app/yourname", period: "Per store", max: lim.customDomain ? null : false, used: undefined },
  ];
  const reached = rows.filter((r) => typeof r.max === "number" && r.used !== undefined && r.used >= r.max);

  return (
    <div className="flex flex-col gap-4">
      {/* Where the account stands, and what a limit does */}
      <div className={cn("flex flex-wrap items-center gap-3 rounded-card border p-4", reached.length ? "border-warning/40 bg-warning-soft/40" : "bg-surface")}>
        {reached.length ? <AlertTriangle className="size-5 shrink-0 text-warning-ink" aria-hidden /> : <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />}
        <p className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold">{reached.length ? `${reached.map((r) => r.name).join(", ")}: limit reached` : `Within every ${state.plan.name} limit`}</span>
          <span className="block text-muted-foreground">At a limit you can&apos;t add more; nothing already live stops.{state.joined ? " These are the workspace owner's limits." : ""}</span>
        </p>
        {free && !state.joined && (
          <Button onClick={() => upgrade()}>
            <Sparkles aria-hidden /> Upgrade to Pro
          </Button>
        )}
      </div>

      <ul className="divide-y rounded-card border bg-surface">
        {rows.map((r) => (
          <Row key={r.name} l={r} />
        ))}
      </ul>

      <details className="group rounded-card border">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">Compare Free and Pro</summary>
        <div className="overflow-x-auto border-t">
          <PlanComparisonTable current={state.tier} />
        </div>
      </details>
    </div>
  );
}
