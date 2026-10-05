"use client";

import { AiPanelProvider } from "@/components/ai/ai-panel-provider";
import { GettingStartedProvider } from "@/components/getting-started/getting-started-provider";
import { PlanProvider } from "@/components/plan/plan-context";
import { UnsavedChangesProvider } from "@/components/save/unsaved-guard";

/** App-wide creator context: plan limits, unsaved-changes guard, AI image panel, getting started. */
export function CreatorProviders({ children, tracker = true }: { children: React.ReactNode; tracker?: boolean }) {
  return (
    <PlanProvider>
      <UnsavedChangesProvider>
        <AiPanelProvider>{tracker ? <GettingStartedProvider>{children}</GettingStartedProvider> : children}</AiPanelProvider>
      </UnsavedChangesProvider>
    </PlanProvider>
  );
}
