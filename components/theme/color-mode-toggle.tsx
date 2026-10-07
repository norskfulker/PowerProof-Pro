"use client";

import { useRef } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColorModeOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

export const LIGHT_DARK: ColorModeOption<"light" | "dark">[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export const LIGHT_DARK_AUTO: ColorModeOption<"light" | "dark" | "auto">[] = [...LIGHT_DARK, { value: "auto", label: "Auto", icon: Monitor }];

/**
 * The one colour-mode switch: a segmented radio group with a sliding thumb. Used for the creator
 * app, the store's default mode and the storefront footer. Arrow keys move and select (Home and
 * End jump), every segment is at least 44px tall, and the thumb doesn't animate when the person
 * prefers reduced motion.
 */
export function ColorModeToggle<T extends string>({
  value,
  onChange,
  options,
  label,
  iconOnly = false,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ColorModeOption<T>[];
  /** Names the group for screen readers, e.g. "Colour mode" */
  label: string;
  /** Icons only on tight bars; the labels stay available to screen readers */
  iconOnly?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;

  function move(to: number) {
    const next = (to + n) % n;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("relative inline-grid rounded-full border bg-muted p-1", className)}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(2.75rem, 1fr))` }}
    >
      <span
        aria-hidden
        data-slot="color-mode-thumb"
        className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-surface shadow-pop transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o, i) => {
        const checked = i === index;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={iconOnly ? o.label : undefined}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const k = e.key;
              if (k === "ArrowRight" || k === "ArrowDown") move(i + 1);
              else if (k === "ArrowLeft" || k === "ArrowUp") move(i - 1);
              else if (k === "Home") move(0);
              else if (k === "End") move(n - 1);
              else return;
              // Don't let a surrounding menu or page also react to the arrow
              e.preventDefault();
              e.stopPropagation();
            }}
            className={cn(
              "relative z-10 inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary",
              checked ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <o.icon className="size-4 shrink-0" aria-hidden />
            {!iconOnly && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
