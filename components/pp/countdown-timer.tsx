"use client";

import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Live countdown. Announces only every minute to screen readers. */
export function CountdownTimer({ endsAt, className, compact, onDark }: { endsAt: string; className?: string; compact?: boolean; onDark?: boolean }) {
  const now = useNow();
  // Server render and hydration show dashes in the same boxes; the clock starts right after
  const pending = now === null;
  const left = Date.parse(endsAt) - (now ?? 0);
  const p = parts(left);
  if (!pending && left <= 0) return <span className={className}>Ended</span>;
  const units: [number | string, string][] = pending ? [["--", "h"], ["--", "m"], ["--", "s"]] : p.d > 0 ? [[p.d, "d"], [p.h, "h"], [p.m, "m"]] : [[p.h, "h"], [p.m, "m"], [p.s, "s"]];
  const label = pending ? "Time left loading" : `Ends in ${p.d ? `${p.d} days ` : ""}${p.h} hours ${p.m} minutes`;
  if (compact) {
    return (
      <span className={cn("font-mono tabular", className)} aria-label={label}>
        {units.map(([v, u]) => `${String(v).padStart(2, "0")}${u}`).join(" ")}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1", className)} role="timer" aria-label={label}>
      {units.map(([v, u]) => (
        <span key={u} className={cn("flex min-w-11 flex-col items-center rounded-control px-2 py-1", onDark ? "bg-primary-foreground/15" : "bg-surface")}>
          <span className="font-mono text-lg font-semibold tabular">{String(v).padStart(2, "0")}</span>
          <span className="font-mono text-[0.625rem] uppercase opacity-80">{u}</span>
        </span>
      ))}
    </span>
  );
}
