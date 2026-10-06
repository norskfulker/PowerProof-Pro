"use client";

import { ProgressRing } from "@/components/getting-started/parts";
import { StepList, useGettingStarted } from "@/components/getting-started/getting-started-provider";
import { PageHeader } from "@/components/pp/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Home › Getting started: the whole checklist on its own page. */
export default function GettingStartedPage() {
  const { checklist } = useGettingStarted();
  const done = checklist?.steps.filter((s) => s.state === "done" || s.state === "skipped").length ?? 0;
  return (
    <>
      <title>Getting started · PowerProof</title>
      <PageHeader title="Getting started" description="Ten steps from sign-up to your first sale. Optional steps can be skipped." />
      {!checklist ? (
        <Skeleton className="h-96 max-w-3xl rounded-card" />
      ) : (
        <section aria-label="Checklist" className="flex max-w-3xl flex-col gap-4 rounded-card border bg-surface p-5 md:p-6">
          <div className="flex items-center gap-4">
            <ProgressRing percent={checklist.percent} size={56} />
            <div>
              <p className="font-semibold">{checklist.complete ? "Everything required is done" : `Next: ${checklist.next?.title}`}</p>
              <p className="text-sm text-muted-foreground">{done} of {checklist.steps.length} steps done or skipped.</p>
            </div>
          </div>
          <StepList checklist={checklist} />
        </section>
      )}
    </>
  );
}
