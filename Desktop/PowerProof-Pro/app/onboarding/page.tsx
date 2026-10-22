"use client";

import { useRouter } from "next/navigation";
import { SetupJourney } from "@/components/onboarding/setup-journey";
import { StepStore } from "@/components/onboarding/step-store";

/** The only onboarding step: a name and a country. Then straight to the first product. */
export default function OnboardingPage() {
  const router = useRouter();
  // The (app) layout checks on the server that the store now exists
  return (
    <div className="flex flex-col gap-6">
      <SetupJourney current={0} />
      <StepStore onDone={() => router.replace("/catalog/products/new")} />
    </div>
  );
}
