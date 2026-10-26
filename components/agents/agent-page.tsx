"use client";

import Link from "next/link";
import { ArrowRight, Check, Clock, Coins, Plug, ShieldCheck, Sparkles } from "lucide-react";
import { FaqAccordion } from "@/components/pp/faq-accordion";
import { ErrorState, EmptyState } from "@/components/pp/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { cronEvery, type AgentManifest } from "@/lib/agents/define";
import { describeSchedule, effectiveSchedule } from "@/lib/agents/schedule";
import { getCatalog } from "@/lib/api/agents";
import { cn } from "@/lib/utils";
import { CategoryIcon, CHANNELS, channelsOf, PER_CREDIT, SOURCES, sourcesOf, toneFor } from "./catalog";
import { DemandForm } from "./demand-form";
import { HowItWorks, SampleOutput } from "./how-it-works";
import { RatingLine, RatingsSection, useRatings } from "./ratings";

/**
 * One agent's page. Live agents are drawn from their manifest: quick facts, step-by-step
 * instructions, how it works, pricing, what it reads and produces, safeguards, what it works with,
 * stars from stores that ran it, and questions. Coming-soon ones collect demand.
 * `inApp`: inside the app (menu and top bar), launching straight into this workspace.
 */
export function AgentPage({ agentId, inApp = false }: { agentId: string; inApp?: boolean }) {
  const home = inApp ? "/marketplace" : "/agents";
  const { data, loading, error, reload } = useApi(getCatalog, []);
  const ratings = useRatings(agentId);
  // Ratings that can't load read as none yet; the rest of the page doesn't depend on them
  const stars = ratings.error ? { average: null, count: 0, recent: [] } : ratings.data;
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
        action={
          <Button asChild variant="secondary">
            <Link href={home}>See all agents</Link>
          </Button>
        }
      />
    );

  const m = a.manifest;
  const tone = toneFor(a.category);
  const start = inApp ? `/marketplace/agents/${a.id}/launch` : `/agents/start/${a.id}`;
  const cta = inApp ? "Launch agent" : "Try free";
  const sections = m
    ? ([
        ["instructions", "Instructions", m.instructions.length > 0],
        ["how", "How it works", true],
        ["pricing", "Pricing", true],
        ["format", "Format", !!m.formats],
        ["safeguards", "Safeguards", true],
        ["works-with", "Works with", true],
        ["ratings", "Ratings", true],
        ["faq", "FAQ", m.help.faq.length > 0],
      ] as const).filter(([, , on]) => on)
    : [];

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4">
        <Link href={home} className="text-sm text-muted-foreground hover:text-foreground">
          ← {inApp ? "Marketplace" : "All agents"}
        </Link>
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-card text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 55%, black))` }}>
            <CategoryIcon category={a.category} className="size-7" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="eyebrow">{a.category}</p>
            <h1 className="text-[2.25rem] leading-tight sm:text-5xl">{a.name}</h1>
          </div>
        </div>
        <p className="max-w-2xl text-lg text-muted-foreground">{a.tagline}</p>
        <a href="#ratings" className="self-start">
          <RatingLine summary={stars} />
        </a>
        {m && a.enabled ? (
          <Button asChild size="lg" className="self-start">
            <Link href={start}>
              {cta} <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : m ? (
          <p className="text-muted-foreground">{a.name} is paused for new sign-ups for a short while.</p>
        ) : null}
      </header>

      {m ? (
        <>
          <Facts m={m} tone={tone} />
          <nav aria-label="On this page" className="-mt-6 flex flex-wrap gap-2">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="inline-flex min-h-9 items-center rounded-full border bg-surface px-3.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground pointer-coarse:min-h-11">
                {label}
              </a>
            ))}
          </nav>

          {m.instructions.length > 0 && (
            <Section id="instructions" title="Instructions">
              <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {m.instructions.map((t, i) => (
                  <li key={i} className="flex flex-col gap-3 rounded-card border bg-surface p-4">
                    <span className="grid size-8 place-items-center rounded-full font-mono text-sm font-bold text-white" style={{ background: tone }}>
                      {i + 1}
                    </span>
                    <span className="text-sm">{t}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <Section id="how" title="How it works">
            <p className="max-w-2xl text-muted-foreground">{a.description}</p>
            <HowItWorks manifest={m} />
          </Section>

          <Section id="pricing" title="Pricing">
            <Pricing m={m} />
          </Section>

          {m.formats && (
            <Section id="format" title="Format">
              <Formats m={m} />
            </Section>
          )}

          <Section id="safeguards" title="Safeguards">
            <Safeguards m={m} />
          </Section>

          <Section id="works-with" title="Works with">
            <WorksWith m={m} />
          </Section>

          <Section id="ratings" title="Ratings">
            <RatingsSection agentId={a.id} agentName={a.name} summary={stars} onRated={ratings.reload} inApp={inApp} />
          </Section>

          {m.help.faq.length > 0 && (
            <Section id="faq" title="FAQ">
              <FaqAccordion items={m.help.faq.map((f, i) => ({ id: String(i), ...f }))} className="max-w-3xl" />
            </Section>
          )}

          {a.enabled && (
            <div className="sticky bottom-4 z-10 sm:hidden">
              <Button asChild size="lg" className="w-full shadow-lift">
                <Link href={start}>{inApp ? `Launch ${a.name}` : `Try ${a.name} free`}</Link>
              </Button>
            </div>
          )}
        </>
      ) : (
        <section aria-labelledby="want" className="grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h2 id="want" className="text-2xl">Coming soon</h2>
            <p className="mt-2 text-muted-foreground">{a.description}</p>
          </div>
          <DemandForm agentId={a.id} agentName={a.name} />
        </section>
      )}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-24 flex-col gap-4">
      <h2 id={`${id}-h`} className="text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Four coloured boxes: when it runs, the free start, the price after, what it works with */
function Facts({ m, tone }: { m: AgentManifest; tone: string }) {
  const facts = [
    { icon: Clock, label: "Runs", value: describeSchedule(effectiveSchedule(null, cronEvery(m))), note: "24/7, on its own" },
    { icon: Sparkles, label: "Free to start", value: `${m.trial.credits} credits`, note: "No card needed" },
    { icon: Coins, label: "Then", value: `${PER_CREDIT} a credit`, note: "Any amount, no plan" },
    { icon: Plug, label: "Works with", value: `${sourcesOf(m).length + channelsOf(m).length} tools`, note: [...sourcesOf(m).map((s) => SOURCES[s]), ...channelsOf(m).map((c) => CHANNELS[c])].slice(0, 3).join(", ") },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {facts.map((f, i) => (
        <li key={f.label} className="flex flex-col gap-2 rounded-card border p-4" style={{ backgroundImage: `linear-gradient(150deg, color-mix(in oklab, ${tone} ${18 - i * 3}%, var(--surface)), var(--surface) 75%)` }}>
          <f.icon className="size-5" style={{ color: tone }} aria-hidden />
          <span className="text-xs text-muted-foreground">{f.label}</span>
          <span className="font-display text-lg leading-tight font-bold">{f.value}</span>
          <span className="truncate text-xs text-muted-foreground">{f.note}</span>
        </li>
      ))}
    </ul>
  );
}

function Pricing({ m }: { m: AgentManifest }) {
  const costs = Object.entries(m.creditCosts);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="overflow-x-auto rounded-card border bg-surface">
        <Table aria-label="What uses credits">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">What it does</TableHead>
              <TableHead scope="col" className="text-right">Credits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs
              .sort((a, b) => b[1] - a[1])
              .map(([reason, n]) => (
                <TableRow key={reason}>
                  <TableCell>{m.creditLabels[reason] ?? reason.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right font-semibold tabular">{n === 0 ? "Free" : n}</TableCell>
                </TableRow>
              ))}
            <TableRow>
              <TableCell>Free preview (dry run)</TableCell>
              <TableCell className="text-right font-semibold">Free</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Something that fails</TableCell>
              <TableCell className="text-right font-semibold">Credit back</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <dl className="flex flex-col gap-3 rounded-card border bg-surface p-5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">To start</dt>
          <dd className="font-semibold">{m.trial.credits} free credits</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Each credit</dt>
          <dd className="font-semibold">{PER_CREDIT}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Monthly fee</dt>
          <dd className="font-semibold">None</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">At zero credits</dt>
          <dd className="font-semibold">It pauses</dd>
        </div>
      </dl>
    </div>
  );
}

const NEED = { required: "Needed", optional: "Optional", either: "One of these" } as const;

function Formats({ m }: { m: AgentManifest }) {
  const f = m.formats!;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {f.input.map((inp) => (
        <div key={inp.name} className="flex flex-col gap-3">
          <h3 className="font-semibold">What it reads: {inp.name}</h3>
          <div className="flex flex-wrap gap-1.5">
            {inp.accepts.map((x) => (
              <span key={x} className="rounded-full border bg-surface px-2.5 py-0.5 text-xs font-medium">
                {x}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto rounded-card border bg-surface">
            <Table aria-label={`${inp.name} columns`}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Column</TableHead>
                  <TableHead scope="col">Needed</TableHead>
                  <TableHead scope="col">Example</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inp.columns.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", c.need === "required" ? "bg-primary-soft text-primary" : c.need === "either" ? "bg-accent/15 text-accent-ink" : "bg-muted text-muted-foreground")}>{NEED[c.need]}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.example}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-3">
        <h3 className="font-semibold">What it makes</h3>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {f.output.map((o) => (
            <li key={o.name} className="flex flex-col gap-1 rounded-card border bg-surface p-3.5">
              <span className="font-semibold">{o.name}</span>
              <span className="text-sm text-muted-foreground">{o.detail}</span>
            </li>
          ))}
        </ul>
        <SampleOutput manifest={m} />
      </div>
    </div>
  );
}

function Safeguards({ m }: { m: AgentManifest }) {
  const g = m.guardrails;
  const rules = [
    ["Sending hours", `${g.sendWindow.replace("-", " to ")} India time`],
    ["Per customer", `At most ${g.maxMessagesPerContactPerDays.messages} message every ${g.maxMessagesPerContactPerDays.days} days`],
    ["Per day", `At most ${g.dailySendCap} messages, or less if you set it`],
    ["Blocked words", `${g.forbiddenPhrases.length} threatening phrases can never be sent`],
    ["Opt-out", "One tap, and that customer gets nothing more"],
  ];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ul className="flex flex-col gap-2.5">
        {m.highlights.map((t) => (
          <li key={t} className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> {t}
          </li>
        ))}
      </ul>
      <dl className="divide-y rounded-card border bg-surface text-sm">
        {rules.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium sm:text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function WorksWith({ m }: { m: AgentManifest }) {
  const groups = [
    ["Reads from", sourcesOf(m).map((s) => SOURCES[s])],
    ["Sends by", channelsOf(m).map((c) => CHANNELS[c])],
    ["Coming soon", m.connectors.filter((c) => c.disabledUntil).map((c) => c.label)],
  ] as const;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {groups
        .filter(([, list]) => list.length)
        .map(([label, list]) => (
          <div key={label} className="flex flex-col gap-2.5 rounded-card border bg-surface p-4">
            <span className="text-xs text-muted-foreground">{label}</span>
            <ul className="flex flex-wrap gap-1.5">
              {list.map((x) => (
                <li key={x} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-medium">
                  <Check className="size-3.5 text-success" aria-hidden /> {x}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
