"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AGENT_UI } from "@/agents/ui";
import { getManifest } from "@/agents/index";
import { ErrorState } from "@/components/pp/empty-state";
import { StepProgress } from "@/components/pp/step-progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { agentOp, getInstance, saveAgentSettings } from "@/lib/api/agents";
import { DryRun } from "./dry-run";
import { SettingsFields } from "./settings-form";

/**
 * Setup, drawn from the manifest: 1 bring in data, 2 free preview (a dry run: nothing sent, no
 * credits), 3 rules (sensible defaults), 4 switch on (consent + free credits). Nothing goes out
 * before step 4.
 */
export function SetupWizard({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const { data: instance, loading, error, reload } = useApi(() => getInstance(instanceId), [instanceId]);
  const [step, setStep] = useState(0);
  const [dataReady, setDataReady] = useState(false);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const onReady = useCallback((r: boolean) => setDataReady(r), []);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !instance) return <Skeleton className="h-96 rounded-card" />;
  const m = getManifest(instance.agentId);
  if (!m) return <ErrorState message="This agent isn't available any more." />;
  const ui = AGENT_UI[instance.agentId] ?? {};
  const values = settings ?? instance.settings;
  if (instance.status !== "setup" && step === 0 && !busy)
    return (
      <div className="flex flex-col items-start gap-3">
        <p>{m.name} is already set up.</p>
        <Button asChild>
          <Link href={`/agents/my/${instance.id}`}>Open {m.name}</Link>
        </Button>
      </div>
    );

  const steps = ["Your details", "Free preview", "Rules", "Run"];
  const saveRules = async () => {
    if (!settings) return true;
    try {
      await saveAgentSettings(instance.id, settings);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check the settings.");
      return false;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <StepProgress steps={steps} current={step} />
      {step === 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="s1">
          <h2 id="s1" className="text-2xl">{m.connectors.find((c) => c.required)?.label ?? "Your data"}</h2>
          <p className="text-muted-foreground">{m.connectors.find((c) => c.required)?.why}</p>
          {ui.DataStep ? <ui.DataStep instance={instance} onReady={onReady} /> : <p className="text-sm text-muted-foreground">Nothing to connect for this agent.</p>}
          <Button size="lg" disabled={!!ui.DataStep && !dataReady} onClick={() => setStep(1)}>
            Next: free preview
          </Button>
        </section>
      )}
      {step === 1 && (
        <section className="flex flex-col gap-4" aria-labelledby="s2">
          <h2 id="s2" className="text-2xl">Here&apos;s what {m.name} would do</h2>
          {ui.PreviewSummary && <ui.PreviewSummary instance={instance} />}
          <DryRun instanceId={instance.id} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setStep(2)}>
              Next: rules
            </Button>
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="flex flex-col gap-5" aria-labelledby="s3">
          <h2 id="s3" className="text-2xl">Rules</h2>
          <p className="text-muted-foreground">These are sensible defaults. Change anything later in Settings.</p>
          <SettingsFields manifest={m} value={values} onChange={setSettings} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" disabled={busy} onClick={async () => (await saveRules()) && setStep(3)}>
              Next
            </Button>
          </div>
        </section>
      )}
      {step === 3 && (
        <section className="flex flex-col gap-5" aria-labelledby="s4">
          <h2 id="s4" className="text-2xl">Run {m.name}</h2>
          <ul className="flex flex-col gap-2 text-muted-foreground">
            <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-success" aria-hidden /> {m.trial.credits} free credits to start. It runs once now, then on its schedule. Each run takes one credit per finished task, like one reminder sent; failed ones don&apos;t count.</li>
            <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-success" aria-hidden /> When credits run out it pauses. Nothing is ever charged without you.</li>
            <li className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-success" aria-hidden /> Pause it any time from its page.</li>
          </ul>
          {m.consents.map((text) => (
            <label key={text} className="flex min-h-11 items-start gap-3 rounded-control border bg-surface p-3">
              <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
              <span>{text}</span>
            </label>
          ))}
          <p className="text-sm text-muted-foreground">
            Read the{" "}
            <Link href="/agents/terms" target="_blank" className="underline">
              agent terms and privacy notes
            </Link>{" "}
            (draft).
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={!consent || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await agentOp<{ status: string }>(instance.id, { op: "activate", consent });
                  if (r.status === "trial_ended") toast.success("Set up, but there are no credits left to run it.");
                  else {
                    // The first run starts now; credits are taken per finished task, then on every scheduled run
                    await agentOp(instance.id, { op: "run" }).then(
                      () => toast.success(`${m.name} ran for the first time. It runs on its schedule from now on.`),
                      () => toast.success(`${m.name} is on. Its first run starts shortly.`)
                    );
                  }
                  router.replace(`/agents/my/${instance.id}`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
                  setBusy(false);
                }
              }}
            >
              <Rocket aria-hidden /> {busy ? "Running…" : `Run ${m.name}`}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
