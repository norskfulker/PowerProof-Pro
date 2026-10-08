"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dismissChecklist } from "@/lib/api";
import { useGettingStarted, StepList } from "./getting-started-provider";
import { ProgressRing } from "./parts";

/** Top of the dashboard until setup is done: progress, the next step, and the rest on demand. */
export function GettingStartedCard({ bare = false }: { /** Inside another box (the dashboard's Getting started section): no border or margin of its own */ bare?: boolean }) {
  const { checklist, reload } = useGettingStarted();
  const [all, setAll] = useState(false);
  if (!checklist || checklist.dismissed) return null;
  const next = checklist.next;
  const finished = checklist.steps.filter((s) => s.state === "done" || s.state === "skipped").length;
  return (
    <section aria-labelledby="gs-title" className={bare ? undefined : "mb-6 rounded-card border border-primary/30 bg-surface p-4 md:p-5"}>
      <div className="flex flex-wrap items-start gap-4">
        <ProgressRing percent={checklist.percent} size={56} stroke={5} />
        <div className="min-w-0 flex-[1_1_14rem]">
          <h2 id="gs-title" className="font-display text-xl">Getting started</h2>
          <p className="text-sm text-muted-foreground">
            {finished} of {checklist.steps.length} steps done.{" "}
            {checklist.complete ? "Everything required is done." : next ? `Next: ${next.title.toLowerCase()}.` : ""}
          </p>
        </div>
        {checklist.complete ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await dismissChecklist(true);
              reload();
              toast("Checklist hidden", { description: "Reopen it any time from the help menu." });
            }}
          >
            <X aria-hidden /> Hide
          </Button>
        ) : null}
      </div>
      {next && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-control bg-primary-soft p-3">
          <div className="min-w-0 flex-[1_1_14rem]">
            <p className="text-sm font-semibold">
              Step {next.n}: {next.title}
            </p>
            <p className="text-xs text-muted-foreground">{next.detail ?? next.why}</p>
            {next.needsUpgrade && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning-ink">
                <Lock className="size-3.5" aria-hidden /> This needs Pro on your plan.
              </p>
            )}
          </div>
          <Button asChild size="lg">
            <Link href={next.href}>
              Next step <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      )}
      <Button type="button" variant="ghost" size="sm" className="mt-3" aria-expanded={all} onClick={() => setAll((a) => !a)}>
        <ChevronDown aria-hidden className={all ? "rotate-180" : undefined} /> {all ? "Hide steps" : "See all steps"}
      </Button>
      {all && (
        <div className="mt-2">
          <StepList checklist={checklist} />
        </div>
      )}
    </section>
  );
}

/** Small progress ring for the sidebar; opens the full checklist. Hidden once dismissed. */
export function SidebarProgress() {
  const { checklist, openDrawer } = useGettingStarted();
  if (!checklist || checklist.dismissed) return null;
  return (
    <button type="button" onClick={openDrawer} className="flex min-h-11 w-full items-center gap-3 rounded-card border bg-surface p-2.5 text-left hover:border-border-strong" aria-label={`Getting started, ${checklist.percent}% done. Open the checklist.`}>
      <ProgressRing percent={checklist.percent} size={36} stroke={3.5} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">Getting started</span>
        <span className="block truncate text-xs text-muted-foreground">{checklist.next ? `Next: ${checklist.next.title}` : "All done"}</span>
      </span>
    </button>
  );
}

/** For empty states: points at the next pending step instead of a generic message. */
export function NextStepHint({ className }: { className?: string }) {
  const { checklist } = useGettingStarted();
  const next = checklist?.next;
  if (!next || checklist?.dismissed) return null;
  return (
    <p className={className}>
      <Link href={next.href} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
        Next step: {next.title} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </p>
  );
}
