"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { StepStore } from "@/components/onboarding/step-store";
import { EmptyState } from "@/components/pp/empty-state";
import { Button } from "@/components/ui/button";

/** Creates the store if needed (the existing store step), then opens the agent's launch inside the app */
export function StartAgent({ agentId, agentName, hasStore }: { agentId: string; agentName: string | null; hasStore: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(hasStore);

  // Once there's a store, the launch runs inside the app
  useEffect(() => {
    if (ready && agentName) router.replace(`/marketplace/agents/${agentId}/launch`);
  }, [ready, agentId, agentName, router]);

  if (!agentName)
    return (
      <EmptyState
        title="That agent isn't available."
        action={
          <Button asChild variant="secondary">
            <Link href="/agents">See all agents</Link>
          </Button>
        }
      />
    );

  if (!ready)
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6 pt-6">
        <div>
          <p className="eyebrow">Step 1 of 2 · Your business</p>
          <h1 className="mt-2 text-3xl">First, your business name</h1>
          <p className="mt-2 text-muted-foreground">{agentName} signs messages with it. Then we launch {agentName}.</p>
        </div>
        <StepStore onDone={() => setReady(true)} />
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-3 pt-24 text-center" role="status">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-muted-foreground">Opening {agentName}…</p>
    </div>
  );
}
