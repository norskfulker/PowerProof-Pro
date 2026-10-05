import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepProgress({
  steps,
  current,
  className,
}: {
  steps: string[];
  /** Zero-based index of the active step. */
  current: number;
  className?: string;
}) {
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <p className="eyebrow mb-3 sm:hidden">
        {current >= steps.length ? (
          "All done"
        ) : (
          <>
            Step {current + 1} of {steps.length} · <span className="text-foreground">{steps[current]}</span>
          </>
        )}
      </p>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex flex-1 flex-col gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "h-1.5 rounded-full transition-colors duration-200",
                  done ? "bg-primary" : active ? "bg-accent" : "bg-border-strong"
                )}
              />
              <span className="hidden items-center gap-1.5 text-xs font-medium sm:flex">
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px]",
                    done ? "bg-primary text-primary-foreground" : active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-3" aria-hidden /> : i + 1}
                </span>
                <span className={cn("truncate", !active && !done && "text-muted-foreground")}>{label}</span>
                <span className="sr-only">{done ? "(done)" : active ? "(current)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
