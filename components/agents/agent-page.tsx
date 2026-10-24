"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { ErrorState, EmptyState } from "@/components/pp/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getCatalog } from "@/lib/api/agents";
import { DemandForm } from "./demand-form";
import { HowItWorks, SampleOutput } from "./how-it-works";
import { priceLine } from "./catalog";

/** One agent's public page. Live agents are drawn from their manifest; coming-soon ones collect demand. */
export function AgentPage({ agentId }: { agentId: string }) {
  const { data, loading, error, reload } = useApi(getCatalog, []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24" />
      </div>
    );
  const a = data.find((x) => x.id === agentId);
  if (!a)
    return (
      <EmptyState
        title="That agent isn't here."
        body="It may have been renamed or taken down."
        action={
          <Button asChild variant="secondary">
            <Link href="/agents">See all agents</Link>
          </Button>
        }
      />
    );

  const m = a.manifest;
  const price = priceLine(a);
  const start = `/agents/start/${a.id}`;
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4">
        <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground">
          ← All agents
        </Link>
        <p className="eyebrow">{a.category}</p>
        <h1 className="text-[2.25rem] sm:text-5xl">{a.name}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{a.tagline}</p>
        {m && a.enabled ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href={start}>
                Try free <ArrowRight aria-hidden />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              {m.trial.credits} free credits{m.trial.days ? ` or ${m.trial.days} days` : ""}, no card. {price ? `After that, ${price}.` : ""}
            </p>
          </div>
        ) : m ? (
          <p className="text-muted-foreground">{a.name} is paused for new sign-ups for a short while. Check back soon.</p>
        ) : null}
      </header>

      {m ? (
        <>
          <section aria-labelledby="about" className="max-w-2xl">
            <h2 id="about" className="text-2xl">What it does</h2>
            <p className="mt-2 text-muted-foreground">{a.description}</p>
          </section>
          <section aria-labelledby="how" className="flex flex-col gap-4">
            <h2 id="how" className="text-2xl">How it works</h2>
            <HowItWorks manifest={m} />
          </section>
          <section aria-labelledby="sample" className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h2 id="sample" className="text-2xl">Safeguards</h2>
              <ul className="mt-3 flex flex-col gap-2 text-muted-foreground">
                {m.highlights.map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <SampleOutput manifest={m} />
          </section>
          {m.help.faq.length > 0 && (
            <section aria-labelledby="faq" className="max-w-2xl">
              <h2 id="faq" className="text-2xl">Questions</h2>
              <FaqAccordion items={m.help.faq.map((f, i) => ({ id: String(i), ...f }))} className="mt-3" />
            </section>
          )}
          {a.enabled && (
            <div className="sticky bottom-4 z-10 sm:hidden">
              <Button asChild size="lg" className="w-full shadow-lift">
                <Link href={start}>Try {a.name} free</Link>
              </Button>
            </div>
          )}
        </>
      ) : (
        <section aria-labelledby="want" className="grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h2 id="want" className="text-2xl">Coming soon</h2>
            <p className="mt-2 text-muted-foreground">{a.description}</p>
            <p className="mt-2 text-muted-foreground">Tell us you want it. We build the most-asked-for agents first.</p>
          </div>
          <DemandForm agentId={a.id} agentName={a.name} />
        </section>
      )}
    </div>
  );
}
