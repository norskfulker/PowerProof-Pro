"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, TerminalSquare } from "lucide-react";
import { getManifest } from "@/agents/index";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { Button } from "@/components/ui/button";
import { useCurrentStore } from "@/hooks/use-current-store";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cronEvery } from "@/lib/agents/define";
import { startAgent } from "@/lib/api/agents";
import { cn } from "@/lib/utils";
import { SetupWizard } from "./setup-wizard";

const STEP_MS = 420;

/**
 * Launching an agent from the marketplace: a short terminal-style run while the agent is created
 * for this workspace, then its details form appears underneath (data, free preview, rules, run).
 * Running takes credits per finished task, and again on each scheduled run.
 */
export function LaunchAgent({ agentId }: { agentId: string }) {
  const m = getManifest(agentId);
  const { data: store } = useCurrentStore();
  const reduced = useReducedMotion();
  const [instanceId, setInstanceId] = useState<string>();
  const [error, setError] = useState<string>();
  const [shown, setShown] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);
  const below = useRef<HTMLDivElement>(null);

  const every = m ? cronEvery(m) : null;
  const lines = m
    ? [
        `$ powerproof agents launch ${m.id}`,
        `→ loading ${m.name} (${m.category.toLowerCase()})`,
        `→ workspace: ${store?.workspaceName ?? "…"} · store: ${store?.name ?? "…"}`,
        `→ trial: ${m.trial.credits} free credits · then 1 credit per finished task`,
        `→ schedule: ${every === null ? "runs when you start it" : every % 60 === 0 ? `every ${every / 60 === 1 ? "hour" : `${every / 60} hours`}` : `every ${every} minutes`}`,
        `✓ ready. Add your details below.`,
      ]
    : [];
  const typing = !reduced && shown < lines.length - 1;
  // The last line waits for the agent to exist
  const visible = reduced ? (instanceId ? lines.length : lines.length - 1) : Math.min(shown, instanceId ? lines.length : lines.length - 1);
  const done = !!instanceId && visible === lines.length;

  useEffect(() => {
    if (!m || started.current === attempt) return;
    started.current = attempt;
    startAgent(agentId).then(setInstanceId, (e: unknown) => setError(e instanceof Error ? e.message : "That didn't work. Try again."));
  }, [agentId, m, attempt]);

  useEffect(() => {
    if (reduced || !m || shown >= lines.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [reduced, m, shown, lines.length]);

  useEffect(() => {
    if (done) below.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [done, reduced]);

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

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-hidden rounded-card border bg-[#0d1117] text-[#c9d1d9] shadow-sm" role="log" aria-live="polite" aria-label={`Launching ${m.name}`}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs text-white/60">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f56]" />
            <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="size-2.5 rounded-full bg-[#27c93f]" />
          </span>
          <TerminalSquare className="ml-2 size-3.5" aria-hidden /> launch · {m.id}
          {done ? <Check className="ml-auto size-3.5 text-[#27c93f]" aria-hidden /> : <Loader2 className="ml-auto size-3.5 animate-spin" aria-hidden />}
        </div>
        <pre className="min-h-[13.5rem] overflow-x-auto px-4 py-3 font-mono text-[0.8125rem] leading-7 whitespace-pre-wrap">
          {lines.slice(0, visible).map((l, i) => (
            <div key={i} className={cn(l.startsWith("✓") && "text-[#27c93f]", l.startsWith("$") && "text-white")}>
              {l}
            </div>
          ))}
          {!done && !error && <span className={cn("inline-block h-4 w-2 translate-y-0.5 bg-[#c9d1d9]", (typing || !instanceId) && "animate-pulse")} aria-hidden />}
          {error && <div className="text-[#ff7b72]">✗ {error}</div>}
        </pre>
      </div>

      {error ? (
        <ErrorState
          title={`We couldn't launch ${m.name}.`}
          message={error}
          onRetry={() => {
            setError(undefined);
            setShown(0);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <div ref={below} className={cn("scroll-mt-24 transition-opacity duration-500", done ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!done || undefined}>
          {instanceId && done && (
            <section aria-labelledby="launch-details" className="flex flex-col gap-6">
              <div>
                <p className="eyebrow">Add your details</p>
                <h2 id="launch-details" className="mt-1 text-2xl">Set up {m.name}, then run it</h2>
              </div>
              <SetupWizard instanceId={instanceId} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
