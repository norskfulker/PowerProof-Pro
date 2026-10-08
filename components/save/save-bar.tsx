"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DirtyForm } from "@/hooks/use-dirty-form";
import { cn } from "@/lib/utils";

/**
 * Forms that autosave show a small status instead (saving, saved, or what went wrong). Otherwise:
 * Save changes and Discard, shown only while something has changed (Part 6F).
 * Phones: a bar fixed above the bottom tab bar. Desktop: sits at the top right of its card.
 * Pass `form` to make Save submit that form (so form validation runs as usual).
 */
export function SaveBar({ state, form, label = "Unsaved changes", className, bottomOffset = "tabbar" }: { state: DirtyForm; form?: string; label?: string; className?: string; bottomOffset?: "tabbar" | "none" }) {
  if (state.autosave) return <AutosaveStatus state={state} className={className} />;
  if (!state.dirty) return null;
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className={cn(
        "z-40 flex flex-wrap items-center gap-2 border-t bg-surface/95 px-4 py-3 shadow-pop backdrop-blur",
        "max-md:fixed max-md:inset-x-0",
        bottomOffset === "tabbar" ? "max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))]" : "max-md:bottom-0 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "md:rounded-control md:border md:px-3 md:py-2 md:shadow-none",
        className
      )}
    >
      <p className="mr-auto min-w-0 text-sm" aria-live="polite">
        {state.error ? (
          <span className="flex items-start gap-1.5 font-medium text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.error}
          </span>
        ) : (
          <span className="text-muted-foreground">{label}</span>
        )}
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={state.discard} disabled={state.saving}>
        Discard
      </Button>
      <Button type={form ? "submit" : "button"} form={form} size="sm" onClick={form ? undefined : state.save} disabled={state.saving}>
        {state.saving && <Loader2 className="animate-spin" aria-hidden />}
        {state.saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

/** Changes save themselves: this only says so. It shows while saving, after a save, and when something needs attention. */
function AutosaveStatus({ state, className }: { state: DirtyForm; className?: string }) {
  const show = state.dirty || state.justSaved || !!state.error;
  if (!show) return null;
  return (
    <div role="status" aria-live="polite" className={cn("z-40 inline-flex w-fit max-w-full items-center gap-2 rounded-full border bg-surface/95 px-3 py-1.5 text-sm shadow-pop backdrop-blur", className)}>
      {state.error ? (
        <>
          <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
          <span className="min-w-0 font-medium text-danger">{state.error}</span>
          <Button type="button" variant="ghost" size="sm" onClick={state.save}>Try again</Button>
        </>
      ) : state.blocked ? (
        <span className="text-muted-foreground">Fix the highlighted fields and it saves on its own.</span>
      ) : state.saving || state.dirty ? (
        <>
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">Saving…</span>
        </>
      ) : (
        <>
          <Check className="size-4 text-success" aria-hidden />
          <span className="text-muted-foreground">All changes saved</span>
        </>
      )}
    </div>
  );
}
