"use client";

import Link from "next/link";
import { useState } from "react";
import { Info, Lock } from "lucide-react";
import { EmptyState } from "@/components/pp/empty-state";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { can } from "@/lib/team";
import { useCurrentStore } from "@/hooks/use-current-store";
import type { InstanceStatus } from "@/lib/agents/define";
import { cn } from "@/lib/utils";

/** Shared pieces for agent screens: status, tap-to-explain numbers, access, India money and dates */

const STATUS: Record<InstanceStatus, [string, "neutral" | "success" | "warning" | "danger" | "info" | "brass"]> = {
  setup: ["Setting up", "info"],
  trial: ["Free trial", "brass"],
  active: ["Running", "success"],
  paused: ["Paused", "neutral"],
  trial_ended: ["Trial ended", "warning"],
  suspended: ["Stopped by PowerProof", "danger"],
};

export function AgentStatus({ status, className }: { status: InstanceStatus; className?: string }) {
  const [label, tone] = STATUS[status];
  return <StatusPill status={status} label={label} tone={tone} className={className} />;
}

export const PAUSED_WHY: Record<string, string> = {
  owner: "You paused it.",
  connection: "A connection it needs stopped working.",
  no_credits: "It ran out of credits.",
  credits_used: "The free credits are used up.",
};

/** A big number that says how it's worked out when tapped */
export function ExplainedNumber({ label, value, explain, emphasis, loading }: { label: string; value: React.ReactNode; explain: string; emphasis?: boolean; loading?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex min-h-11 w-full flex-col items-start rounded-card border bg-surface p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-2 md:p-5" aria-label={`${label}: how this is worked out`}>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {label} <Info className="size-3.5" aria-hidden />
          </span>
          <span className={cn("mt-2 font-display text-[clamp(1.5rem,7vw,2rem)] leading-tight font-bold tracking-[-0.02em] tabular", emphasis && "text-accent-strong", loading && "text-muted-foreground")}>{loading ? "…" : value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm">{explain}</PopoverContent>
    </Popover>
  );
}

/** Agents are for the workspace's owner, admins and members given the Agents area */
export function AgentsGate({ children }: { children: React.ReactNode }) {
  const { data: store } = useCurrentStore();
  if (can(store?.access, "agents")) return <>{children}</>;
  return (
    <EmptyState
      icon={Lock}
      title="Agents aren't part of your access."
      body={`Ask the owner of ${store?.workspaceName ?? "this workspace"} to give you Agents in Settings › Team.`}
      action={
        <Button asChild variant="secondary">
          <Link href="/dashboard">Go to your start page</Link>
        </Button>
      }
    />
  );
}

/** Days since an India date ("2026-10-01"), for "12 days overdue" */
export function daysSince(day: string, now = new Date()): number {
  const [y, m, d] = day.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d) - 330 * 60_000;
  return Math.floor((now.getTime() - start) / 86_400_000);
}

export const supportWhatsApp = () => (process.env.NEXT_PUBLIC_AGENTS_SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");
