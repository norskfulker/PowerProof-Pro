import type { RatingSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Stars } from "./stars";

/** Average, total and a bar per star. Bars filter the list when onFilter is given. */
export function ReviewSummary({
  summary,
  active,
  onFilter,
  className,
}: {
  summary: RatingSummary;
  active?: number;
  onFilter?: (star: number | undefined) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5 rounded-card border bg-surface p-5 sm:flex-row sm:items-center", className)}>
      <div className="flex flex-col items-start gap-1 sm:w-40 sm:shrink-0">
        <span className="font-display text-5xl leading-none">{summary.count ? summary.average.toFixed(1) : "–"}</span>
        <Stars value={summary.average} size="md" />
        <span className="text-sm text-muted-foreground">{summary.count.toLocaleString("en-IN")} verified review{summary.count === 1 ? "" : "s"}</span>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5 pointer-coarse:gap-2" aria-label="Ratings breakdown">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = summary.bars[star - 1];
          const pct = summary.count ? (n / summary.count) * 100 : 0;
          const inner = (
            <>
              <span className="w-12 shrink-0 text-left text-sm">{star} star</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">{n}</span>
            </>
          );
          return (
            <li key={star}>
              {onFilter ? (
                <button
                  type="button"
                  onClick={() => onFilter(active === star ? undefined : star)}
                  aria-pressed={active === star}
                  aria-label={`${star} star: ${n} reviews. ${active === star ? "Clear filter" : "Show only these"}`}
                  className={cn("flex min-h-9 w-full items-center gap-3 rounded-control px-2 hover:bg-muted pointer-coarse:min-h-11", active === star && "bg-primary-soft")}
                >
                  {inner}
                </button>
              ) : (
                <span className="flex min-h-7 items-center gap-3 px-2">{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
