"use client";

import { useEffect } from "react";
import { GettingStartedProvider } from "@/components/getting-started/getting-started-provider";
import { PlanProvider } from "@/components/plan/plan-context";
import { UnsavedChangesProvider } from "@/components/save/unsaved-guard";
import { sb } from "@/lib/supabase/browser";

const BEAT_MS = 3 * 60_000;

/** Tells PowerProof this person is here (once on opening, then every few minutes while the tab is visible). It feeds the admin's active-user and online-now counts and carries no content. */
function ActivityBeat() {
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      // the call only runs once something waits for it; a failed beat is ignored
      (sb() as unknown as { rpc: (fn: string) => PromiseLike<unknown> }).rpc("touch_activity").then(() => undefined, () => undefined);
    };
    beat();
    const t = setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
  return null;
}

/** App-wide creator context: plan limits, unsaved-changes guard, getting started. */
export function CreatorProviders({ children, tracker = true }: { children: React.ReactNode; tracker?: boolean }) {
  return (
    <PlanProvider>
      <ActivityBeat />
      <UnsavedChangesProvider>
        {tracker ? <GettingStartedProvider>{children}</GettingStartedProvider> : children}
      </UnsavedChangesProvider>
    </PlanProvider>
  );
}
