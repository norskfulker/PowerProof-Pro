"use client";

import { PencilRuler, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type SetupMode = "ai" | "manual";

const OPTIONS: { id: SetupMode; title: string; body: string; Icon: typeof Sparkles }[] = [
  { id: "ai", title: "Build with AI", body: "Describe what you sell, or paste a link to your shop. AI drafts your store, products, About and FAQ for you to check.", Icon: Sparkles },
  { id: "manual", title: "Set it up myself", body: "Name your store and add your first product. Design it whenever you like.", Icon: PencilRuler },
];

/**
 * How the creator sets the store up. They can switch as often as they like until the store first
 * opens to buyers; after that the choice is fixed (the database enforces it).
 */
export function SetupChooser({ value, onChange, compact }: { value?: SetupMode; onChange: (m: SetupMode) => void; /** A slim switch above a setup already under way */ compact?: boolean }) {
  if (compact) {
    return (
      <div role="radiogroup" aria-label="How to set up your store" className="inline-flex self-start rounded-full bg-muted p-0.5 text-sm font-medium">
        {OPTIONS.map(({ id, title, Icon }) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 pointer-coarse:min-h-11", value === id ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="size-4" aria-hidden /> {title}
          </button>
        ))}
      </div>
    );
  }
  return (
    <section aria-labelledby="setup-choose-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 id="setup-choose-title" className="text-[1.75rem]">How do you want to start?</h1>
        <p className="text-muted-foreground">You can switch between the two until your store opens.</p>
      </div>
      <div role="radiogroup" aria-labelledby="setup-choose-title" className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ id, title, body, Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            onClick={() => onChange(id)}
            className={cn(
              "group flex flex-col gap-3 rounded-dialog border bg-surface p-5 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary",
              value === id && "border-primary bg-primary-soft/40"
            )}
          >
            <span className={cn("grid size-10 place-items-center rounded-full", id === "ai" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-semibold">{title}</span>
            <span className="text-sm text-muted-foreground">{body}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
