"use client";

import Link from "next/link";
import { ArrowRight, Check, Circle, CircleDashed, CircleDot, Lock, SkipForward, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChecklistStep } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Circular progress with the percentage in the middle. */
export function ProgressRing({ percent, size = 44, stroke = 4, className, label = "Setup progress" }: { percent: number; size?: number; stroke?: number; className?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${percent}%`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} />
      </svg>
      <span className="absolute font-mono text-[0.6875rem] font-semibold" aria-hidden>
        {percent}%
      </span>
    </span>
  );
}

const STATE_TEXT: Record<ChecklistStep["state"], string> = { not_started: "Not started", in_progress: "In progress", done: "Done", skipped: "Skipped" };

/** One step: state icon, title, why, state, and Go / Skip. */
export function StepItem({ step, isNext, onSkip, onUnskip, onGo }: { step: ChecklistStep; isNext?: boolean; onSkip?: () => void; onUnskip?: () => void; onGo?: () => void }) {
  const Icon = step.state === "done" ? Check : step.state === "in_progress" ? CircleDot : step.state === "skipped" ? CircleDashed : Circle;
  return (
    <li className={cn("flex items-start gap-3 rounded-control px-2 py-2.5", isNext && "bg-primary-soft")}>
      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", step.state === "done" ? "bg-success text-white" : step.state === "in_progress" ? "text-primary" : "text-muted-foreground")} aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn("text-sm font-semibold", step.state === "done" && "text-muted-foreground line-through decoration-1")}>
          {step.n}. {step.title}
          {step.optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground no-underline">(optional)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className={cn("font-medium", step.state === "in_progress" ? "text-primary" : step.state === "done" ? "text-success" : undefined)}>{STATE_TEXT[step.state]}</span>
          <span aria-hidden> · </span>
          <span className="sr-only">. </span>
          {step.detail ?? step.why}
        </p>
        {step.needsUpgrade && (
          <p className="flex items-center gap-1 text-xs font-medium text-warning-ink">
            <Lock className="size-3.5" aria-hidden /> Needs Pro: the Free plan&apos;s product slot is used.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 pointer-coarse:gap-2">
        {step.state === "skipped" && onUnskip && (
          <Button type="button" variant="ghost" size="sm" onClick={onUnskip} aria-label={`Undo skip: ${step.title}`}>
            <Undo2 aria-hidden />
          </Button>
        )}
        {step.optional && step.state !== "done" && step.state !== "skipped" && onSkip && (
          <Button type="button" variant="ghost" size="sm" onClick={onSkip} aria-label={`Skip: ${step.title}`}>
            <SkipForward aria-hidden /> <span className="max-sm:sr-only">Skip</span>
          </Button>
        )}
        {step.state !== "done" && step.state !== "skipped" && (
          <Button asChild variant={isNext ? "primary" : "ghost"} size="sm">
            <Link href={step.href} onClick={onGo} aria-label={`Go: ${step.title}`}>
              <ArrowRight aria-hidden /> <span className="max-sm:sr-only">Go</span>
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}
