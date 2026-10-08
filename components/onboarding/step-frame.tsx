import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StepFrame({
  title,
  description,
  children,
  onBack,
  onSkip,
  skipLabel = "Skip for now",
  submitLabel = "Continue",
  pending,
  disabled,
  formId,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  submitLabel?: string;
  pending?: boolean;
  disabled?: boolean;
  /** The step's <form id> so the footer button submits it. */
  formId: string;
}) {
  return (
    <section aria-labelledby={`${formId}-title`} className="rounded-dialog border bg-surface">
      <div className="p-6 sm:p-8">
        <h1 id={`${formId}-title`} className="text-[1.75rem]">
          {title}
        </h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:px-8">
        {onBack && (
          <Button type="button" variant="ghost" onClick={onBack} className="sm:-ml-3">
            <ArrowLeft aria-hidden /> Back
          </Button>
        )}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          {onSkip && (
            <Button type="button" variant="secondary" onClick={onSkip}>
              {skipLabel}
            </Button>
          )}
          <Button type="submit" form={formId} disabled={pending || disabled}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
