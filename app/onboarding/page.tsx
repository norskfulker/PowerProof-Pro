"use client";

import { useRouter } from "next/navigation";
import { StepStore } from "@/components/onboarding/step-store";

/** The only onboarding step: create your store. Everything else lives in the app. */
export default function OnboardingPage() {
  const router = useRouter();
  // The (app) layout checks on the server that the store now exists
  return <StepStore onDone={() => router.replace("/dashboard")} />;
}
