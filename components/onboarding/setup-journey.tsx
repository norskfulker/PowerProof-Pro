"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = ["Create your workspace", "Add your first product", "Share & sell"] as const;

/**
 * The road from sign-up to first sale, shown across onboarding and the first product
 * so the creator always knows what they did, what they're doing, and what's next.
 */
export function SetupJourney({ current }: { /** The stage they're on now (0-based) */ current: 0 | 1 | 2 }) {
  return (
    <ol aria-label="Setup progress" className="flex items-start gap-1 sm:gap-2">
      {STAGES.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} aria-current={now ? "step" : undefined} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex items-center gap-1.5" aria-hidden>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  done && "bg-success text-primary-foreground",
                  now && "bg-primary text-primary-foreground",
                  !done && !now && "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" /> : <span className="font-mono">{i + 1}</span>}
              </span>
              {i < STAGES.length - 1 && <span className={cn("h-0.5 min-w-2 flex-1 rounded-full", i < current ? "bg-success" : "bg-muted")} />}
            </span>
            <span className={cn("truncate text-xs", now ? "font-semibold text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
