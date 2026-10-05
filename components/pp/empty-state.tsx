import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NextStepHint } from "@/components/getting-started/getting-started-card";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  compact,
  nextStep,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
  /** Creator screens: point to the next getting-started step */
  nextStep?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-border-strong bg-surface text-center",
        compact ? "gap-2 px-6 py-8" : "gap-3 px-6 py-14",
        className
      )}
    >
      {Icon && (
        <span className="mb-1 grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-5" />
        </span>
      )}
      <p className="font-display text-lg font-extrabold tracking-[-0.02em]">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
      {nextStep && <NextStepHint />}
    </div>
  );
}

export function ErrorState({
  title = "That didn't load.",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 rounded-card border border-danger/30 bg-danger-soft px-6 py-10 text-center", className)}
    >
      <span className="grid size-11 place-items-center rounded-full bg-surface text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <p className="font-display text-lg font-extrabold tracking-[-0.02em]">{title}</p>
      {message && <p className="max-w-sm text-sm text-foreground/80">{message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RotateCw aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}
