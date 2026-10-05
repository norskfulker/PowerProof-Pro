import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t py-12 first:border-t-0 first:pt-0">
      <h2 id={`${id}-h`} className="text-2xl">
        {title}
      </h2>
      {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
      <div className={cn("mt-6", className)}>{children}</div>
    </section>
  );
}

export function Specimen({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-card border bg-surface p-5", className)}>
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}
