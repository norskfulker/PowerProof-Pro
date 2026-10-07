"use client";

import { GettingStartedProvider } from "@/components/getting-started/getting-started-provider";
import { PlanProvider } from "@/components/plan/plan-context";
import { UnsavedChangesProvider } from "@/components/save/unsaved-guard";

/** App-wide creator context: plan limits, unsaved-changes guard, getting started. */
export function CreatorProviders({ children, tracker = true }: { children: React.ReactNode; tracker?: boolean }) {
  return (
    <PlanProvider>
      <UnsavedChangesProvider>
        {tracker ? <GettingStartedProvider>{children}</GettingStartedProvider> : children}
      </UnsavedChangesProvider>
    </PlanProvider>
  );
}
