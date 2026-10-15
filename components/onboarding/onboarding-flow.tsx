"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setSetupMode } from "@/lib/api";
import type { SetupStore } from "@/lib/supabase/creator-gate";
import { AiSetup } from "./ai-setup";
import { SetupChooser, type SetupMode } from "./setup-chooser";
import { SetupJourney } from "./setup-journey";
import { StepStore } from "./step-store";

/**
 * Onboarding: first how to set the store up (with AI or by hand), then that setup. Until the store
 * first opens the creator can come back here and switch; a store made by hand is then filled in by
 * AI, keeping its link.
 */
export function OnboardingFlow({ existing, initial }: { existing: SetupStore | null; initial?: SetupMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<SetupMode | undefined>(initial ?? existing?.setupMode);
  const [leaving, setLeaving] = useState(false);

  // A store already made by hand: carry on with it, or switch to AI above
  async function continueManual() {
    if (!existing) return;
    setLeaving(true);
    try {
      if (existing.setupMode !== "manual") await setSetupMode("manual", existing.id);
      router.replace("/catalog/products/new");
    } catch (e) {
      setLeaving(false);
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SetupJourney current={0} />
      {!mode ? (
        <SetupChooser value={mode} onChange={setMode} />
      ) : (
        <>
          <SetupChooser compact value={mode} onChange={setMode} />
          {mode === "ai" ? (
            <AiSetup existing={existing} />
          ) : existing ? (
            <section aria-labelledby="manual-title" className="flex flex-col gap-4 rounded-dialog border bg-surface p-6 sm:p-8">
              <h1 id="manual-title" className="text-[1.75rem]">Carry on with {existing.name}</h1>
              <p className="text-muted-foreground">Your store hasn&apos;t opened yet, so you can still switch to Build with AI above. Your link stays the same either way.</p>
              <Button type="button" className="self-start" onClick={() => void continueManual()} disabled={leaving}>
                {leaving ? <Loader2 className="animate-spin" aria-hidden /> : null} Add your first product <ArrowRight aria-hidden />
              </Button>
            </section>
          ) : (
            <StepStore onDone={() => router.replace("/catalog/products/new")} />
          )}
        </>
      )}
    </div>
  );
}
