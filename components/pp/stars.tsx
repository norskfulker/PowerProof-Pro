"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only rating, e.g. 4.6 → four and a half filled stars. */
export function Stars({ value, size = "sm", className }: { value: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const px = size === "lg" ? "size-6" : size === "md" ? "size-5" : "size-4";
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className={cn("relative inline-block", px)} aria-hidden>
            <Star className={cn("absolute inset-0 text-border-strong", px)} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("text-accent", px)} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Star picker for the review form. Arrow keys work because it's a radio group. */
export function StarInput({ value, onChange, invalid }: { value: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void; invalid?: boolean }) {
  const labels = ["Poor", "Not great", "Okay", "Good", "Loved it"];
  return (
    <div role="radiogroup" aria-label="Your rating" aria-invalid={invalid || undefined} className="flex flex-wrap items-center gap-1">
      {([1, 2, 3, 4, 5] as const).map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? "s" : ""}: ${labels[i - 1]}`}
          tabIndex={value === i || (value === 0 && i === 1) ? 0 : -1}
          onClick={() => onChange(i)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(5, (value || 0) + 1) as 1);
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(1, (value || 2) - 1) as 1);
          }}
          className="grid size-11 shrink-0 place-items-center rounded-control hover:bg-muted"
        >
          <Star className={cn("size-7", i <= value ? "text-accent" : "text-border-strong")} fill="currentColor" strokeWidth={0} />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground" aria-live="polite">{value ? labels[value - 1] : "Tap a star"}</span>
    </div>
  );
}
