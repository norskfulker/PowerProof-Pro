import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { requireSetupOpen } from "@/lib/supabase/creator-gate";

/**
 * Setting up a store: with AI or by hand. Open to creators without a store, and to an owner whose
 * only store hasn't opened yet (so they can switch). ?mode=ai or ?mode=manual starts on that setup.
 */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const existing = await requireSetupOpen();
  const mode = (await searchParams).mode;
  return <OnboardingFlow existing={existing} initial={mode === "ai" || mode === "manual" ? mode : undefined} />;
}
