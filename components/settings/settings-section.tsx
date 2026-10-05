import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { cn } from "@/lib/utils";

/** A settings card: heading, body, optional save footer. */
export function SettingsSection({
  title,
  description,
  children,
  footer,
  saveBar,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Shown at the top right of the card on desktop (fixed at the bottom on phones) while there are changes */
  saveBar?: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("rounded-card border bg-surface", className)}>
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {saveBar}
        </div>
        <div className="mt-5">{children}</div>
      </div>
      {footer && <div className="flex items-center justify-end gap-3 border-t px-5 py-3 md:px-6">{footer}</div>}
    </section>
  );
}

export function SettingsLoading({ error, onRetry }: { error?: string; onRetry: () => void }) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
