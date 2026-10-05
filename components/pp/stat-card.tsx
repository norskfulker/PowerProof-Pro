import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  hint,
  emphasis,
  loading,
  className,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  /** Percent change versus the previous period. */
  delta?: number;
  hint?: React.ReactNode;
  /** Brass key number: use once per area. */
  emphasis?: boolean;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className={cn("rounded-card border bg-surface p-5 md:p-6", className)}>
      <p className="eyebrow">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-8 w-28" />
          <Skeleton className="mt-3 h-4 w-20" />
        </>
      ) : (
        <>
          <p
            className={cn(
              "mt-2 font-display text-[clamp(1.25rem,5.5vw,1.75rem)] leading-tight font-extrabold tracking-[-0.02em] tabular",
              emphasis && "text-accent-strong"
            )}
          >
            {value}
          </p>
          <div className="mt-1.5 flex min-h-5 items-center gap-2 text-sm">
            {delta !== undefined && (
              <span className={cn("inline-flex items-center gap-0.5 font-semibold", up ? "text-success" : "text-danger")}>
                {up ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownRight className="size-4" aria-hidden />}
                <span className="sr-only">{up ? "Up" : "Down"}</span>
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        </>
      )}
      {children}
    </div>
  );
}
