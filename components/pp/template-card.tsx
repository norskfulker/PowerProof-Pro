import { Check } from "lucide-react";
import type { TemplateMeta } from "@/lib/templates";
import { cn } from "@/lib/utils";

function Wire({ rows }: { rows: TemplateMeta["wire"] }) {
  return (
    <div className="flex aspect-[4/3] w-full flex-col gap-2 rounded-media border bg-background p-4" aria-hidden>
      {rows.map((r, i) => {
        switch (r) {
          case "h":
            return <span key={i} className="h-3.5 w-3/4 rounded-[3px] bg-foreground" />;
          case "t":
            return (
              <span key={i} className="flex flex-col gap-1">
                <span className="h-1.5 w-full rounded-full bg-border-strong" />
                <span className="h-1.5 w-2/3 rounded-full bg-border-strong" />
              </span>
            );
          case "b":
            return <span key={i} className="h-4 w-16 rounded-[4px] bg-primary" />;
          case "i":
            return <span key={i} className="h-10 w-full rounded-[4px] bg-accent-soft" />;
          case "g":
            return (
              <span key={i} className="grid grid-cols-3 gap-1.5">
                <span className="h-6 rounded-[3px] bg-muted" />
                <span className="h-6 rounded-[3px] bg-muted" />
                <span className="h-6 rounded-[3px] bg-muted" />
              </span>
            );
          case "q":
            return <span key={i} className="h-5 w-full rounded-[4px] border-l-0 bg-primary-soft" />;
        }
      })}
    </div>
  );
}

export function TemplateCard({
  template,
  selected,
  onSelect,
  className,
}: {
  template: TemplateMeta;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col gap-3 rounded-card border bg-surface p-3 text-left transition-[border-color] duration-150 hover:border-border-strong",
        selected && "border-primary outline-2 outline-primary",
        className
      )}
    >
      <Wire rows={template.wire} />
      <div className="px-1 pb-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{template.name}</p>
          {template.popular && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-ink">Popular</span>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
        <p className="eyebrow mt-2">Best for {template.bestFor}</p>
      </div>
      {selected && (
        <span className="absolute top-5 right-5 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-4" aria-hidden />
        </span>
      )}
    </button>
  );
}
