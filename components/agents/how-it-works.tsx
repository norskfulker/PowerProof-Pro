import { ArrowDown, ArrowRight } from "lucide-react";
import type { AgentManifest } from "@/lib/agents/define";

/** The "how it works" diagram, drawn from the manifest's steps (never written by hand per agent) */
export function HowItWorks({ manifest }: { manifest: AgentManifest }) {
  const steps = manifest.steps.map((s) => manifest.howItWorks.find((h) => h.step === s)).filter((h): h is AgentManifest["howItWorks"][number] => !!h);
  return (
    <ol className="grid grid-cols-1 gap-3 md:grid-cols-4" aria-label={`How ${manifest.name} works`}>
      {steps.map((h, i) => (
        <li key={h.step} className="relative flex flex-col rounded-card border bg-surface p-5">
          <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
          <span className="mt-2 font-semibold">{h.title}</span>
          <span className="mt-1 text-sm text-muted-foreground">{h.body}</span>
          {i < steps.length - 1 && (
            <>
              <ArrowDown className="absolute -bottom-3 left-1/2 z-10 size-5 -translate-x-1/2 rounded-full border bg-background p-0.5 text-muted-foreground md:hidden" aria-hidden />
              <ArrowRight className="absolute top-1/2 -right-3 z-10 hidden size-5 -translate-y-1/2 rounded-full border bg-background p-0.5 text-muted-foreground md:block" aria-hidden />
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The manifest's sample message, with its placeholders shown as chips */
export function SampleOutput({ manifest }: { manifest: AgentManifest }) {
  return (
    <figure className="rounded-card border bg-surface p-5">
      <figcaption className="eyebrow">{manifest.sample.title}</figcaption>
      <div className="mt-3 flex flex-col gap-2 rounded-control bg-muted p-4 text-sm leading-relaxed">
        {manifest.sample.lines.map((line, i) => (
          <p key={i}>
            {line.split(/(\{\{[a-z_]+\}\})/).map((part, j) =>
              /^\{\{/.test(part) ? (
                <span key={j} className="mx-0.5 inline-block rounded-full bg-primary-soft px-2 py-0.5 font-mono text-xs text-foreground">
                  {part.slice(2, -2).replace(/_/g, " ")}
                </span>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </p>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">The highlighted parts are filled in by the app from your own data, never by AI.</p>
    </figure>
  );
}
