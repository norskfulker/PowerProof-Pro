import { cn } from "@/lib/utils";

export function AuthCard({
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
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="rounded-dialog border bg-surface p-6 sm:p-8">
        <h1 className="text-[28px]">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
      {message}
    </p>
  );
}
