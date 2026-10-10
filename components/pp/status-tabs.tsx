"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export interface StatusTab<T extends string> {
  value: T;
  label: string;
  /** Shown after the label when known */
  count?: number;
}

/**
 * Tabs for filtering a list by status (All, Live, Draft…). A tablist the whole row long, with
 * counts, arrow-key movement and 44px targets. It filters one list, so it owns no panels.
 */
export function StatusTabs<T extends string>({ tabs, value, onChange, label, className }: { tabs: StatusTab<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));
  const move = (to: number) => {
    const next = (to + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn("mb-4 flex gap-1 overflow-x-auto border-b", className)}>
      {tabs.map((t, i) => {
        const on = i === index;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(i + 1);
              else if (e.key === "ArrowLeft") move(i - 1);
              else if (e.key === "Home") move(0);
              else if (e.key === "End") move(tabs.length - 1);
              else return;
              e.preventDefault();
            }}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold whitespace-nowrap outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-primary",
              on ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-2 py-0.5 font-mono text-[0.6875rem]", on ? "bg-primary-soft text-primary" : "bg-muted")}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
