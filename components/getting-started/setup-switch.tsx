"use client";

import Link from "next/link";
import { PencilRuler, Sparkles } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { getSetupMode, getStore } from "@/lib/api";

/**
 * Until the store first opens, its owner may switch between setting it up with AI and by hand.
 * After that (or for the rest of the team) this shows nothing.
 */
export function SetupSwitch() {
  const { data } = useApi(async () => {
    const store = await getStore();
    if (store.access?.role !== "owner" || store.onboarded) return null;
    return getSetupMode(store.id);
  }, []);
  if (!data || data.locked) return null;
  const toAi = data.mode === "manual";
  const Icon = toAi ? Sparkles : PencilRuler;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      Your store hasn&apos;t opened yet, so you can still change how you set it up.
      <Link href={`/onboarding?mode=${toAi ? "ai" : "manual"}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
        <Icon className="size-4" aria-hidden /> {toAi ? "Build it with AI instead" : "Set it up myself instead"}
      </Link>
    </p>
  );
}
