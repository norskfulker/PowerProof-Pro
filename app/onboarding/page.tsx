"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SetupJourney } from "@/components/onboarding/setup-journey";
import { StepStore } from "@/components/onboarding/step-store";

/**
 * Onboarding: the workspace, then its first store. Then the first product (physical or digital),
 * building the store, showing the product, and getting paid.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState<0 | 1>(0);
  // The (app) layout checks on the server that the workspace's store now exists
  return (
    <div className="flex flex-col gap-6">
      <SetupJourney current={stage} />
      <StepStore onStage={setStage} onDone={() => router.replace("/catalog/products/new")} />
    </div>
  );
}
