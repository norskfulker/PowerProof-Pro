import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { cn } from "@/lib/utils";

/** A settings card: heading, body, optional save footer. */
export function SettingsSection({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("rounded-card border bg-surface", className)}>
      <div className="p-5 md:p-6">
        <h2 className="text-xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
      {footer && <div className="flex items-center justify-end gap-3 border-t px-5 py-3 md:px-6">{footer}</div>}
    </section>
  );
}

export function SaveButton({ pending, dirty, form }: { pending: boolean; dirty: boolean; form?: string }) {
  return (
    <>
      <span className="mr-auto text-sm text-muted-foreground" aria-live="polite">{dirty ? "Unsaved changes" : ""}</span>
      <Button type="submit" form={form} disabled={pending || !dirty}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Save
      </Button>
    </>
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
