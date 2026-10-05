"use client";

import { cn } from "@/lib/utils";

/**
 * Filter switch that looks like tabs but doesn't own panels (tabs without panels
 * produce invalid aria-controls). Buttons with aria-pressed inside a labelled group.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-control bg-muted p-1 pointer-coarse:gap-2", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-[7px] border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11",
            value === o.value ? "border-border bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
