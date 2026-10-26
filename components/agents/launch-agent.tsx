"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getManifest } from "@/agents/index";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { Button } from "@/components/ui/button";
import { useCurrentStore } from "@/hooks/use-current-store";
import { cronEvery } from "@/lib/agents/define";
import { describeSchedule, effectiveSchedule } from "@/lib/agents/schedule";
import { startAgent } from "@/lib/api/agents";
import { PER_CREDIT } from "./catalog";
import { SetupWizard } from "./setup-wizard";
import { AgentTerminal } from "./terminal";

/**
 * Launching an agent from the marketplace. The terminal opens on the agent at once (no click, no
 * scripted typing): what it is, where it runs, when, and what it costs. The agent is created for
 * this workspace in the background; from then on its real work (the free preview, every run)
 * streams into the same terminal, with the setup steps right underneath.
 */
export function LaunchAgent({ agentId }: { agentId: string }) {
  const m = getManifest(agentId);
  const { data: store } = useCurrentStore();
  const [instanceId, setInstanceId] = useState<string>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (!m || started.current === attempt) return;
    started.current = attempt;
    startAgent(agentId).then(setInstanceId, (e: unknown) => setError(e instanceof Error ? e.message : "That didn't work. Try again."));
  }, [agentId, m, attempt]);

  if (!m)
    return (
      <EmptyState
        title="That agent isn't available."
        action={
          <Button asChild variant="secondary">
            <Link href="/marketplace">Back to the marketplace</Link>
          </Button>
        }
      />
    );

  const runs = describeSchedule(effectiveSchedule(null, cronEvery(m)));
  const intro = [
    { text: `$ powerproof agents launch ${m.id}`, tone: "cmd" as const },
    { text: `● ${m.name} · ${m.category}` },
    { text: `  workspace ${store?.workspaceName ?? "…"} · store ${store?.name ?? "…"}`, tone: "dim" as const },
    { text: `  runs ${runs.toLowerCase()}, on its own, and reports to you`, tone: "dim" as const },
    { text: `  ${m.trial.credits} free credits, then ${PER_CREDIT} a credit`, tone: "dim" as const },
    error ? { text: `✗ ${error}`, tone: "warn" as const } : instanceId ? { text: "✓ Ready for your store. Add your details below.", tone: "ok" as const } : { text: "… setting it up for your store", tone: "dim" as const },
  ];

  return (
    <div className="flex flex-col gap-8">
      <AgentTerminal instanceId={instanceId} title={`${m.id} · launch`} intro={intro} height="h-[18rem]" />
      {error ? (
        <ErrorState
          title={`We couldn't launch ${m.name}.`}
          message={error}
          onRetry={() => {
            setError(undefined);
            setAttempt((n) => n + 1);
          }}
        />
      ) : instanceId ? (
        <section aria-labelledby="launch-details" className="flex flex-col gap-6">
          <h2 id="launch-details" className="text-2xl">Set up {m.name}</h2>
          <SetupWizard instanceId={instanceId} />
        </section>
      ) : null}
    </div>
  );
}
