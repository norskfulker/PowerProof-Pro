"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Bot, Check, Clock, Coins, FileSpreadsheet, Megaphone, MessageCircle, Package, Search, Sparkles, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { CREDIT_PRICE, cronEvery, type AgentManifest } from "@/lib/agents/define";
import { getCatalog, getMyAgents, type AgentInstance, type AgentListing } from "@/lib/api/agents";
import { formatMoney } from "@/lib/money";

const PER_CREDIT = formatMoney({ amount: CREDIT_PRICE.perCreditMinor, currency: CREDIT_PRICE.currency });

/** After the free credits: pay as you go, any number of credits at one price */
export function priceLine(a: AgentListing): string | null {
  if (!a.manifest) return null;
  return `${PER_CREDIT} a credit, bought in any amount`;
}

/* What an agent works with, read from its manifest ------------------------------------------- */

const SOURCES = { csv: "CSV file", xlsx: "Excel", sheets: "Google Sheets", email: "Email inbox", manual: "Typed in" } as const;
type Source = keyof typeof SOURCES;
const CHANNELS = { email: "Email", whatsapp: "WhatsApp", sms: "SMS" } as const;
type Channel = keyof typeof CHANNELS;

const sourcesOf = (m: AgentManifest | null): Source[] => (m ? [...new Set(m.connectors.flatMap((c) => c.options))].filter((o): o is Source => o in SOURCES) : []);
function channelsOf(m: AgentManifest | null): Channel[] {
  if (!m) return [];
  const off = new Set(m.connectors.filter((c) => c.disabledUntil).map((c) => c.type));
  const keys = Object.keys(m.creditCosts);
  const out: Channel[] = [];
  if (keys.some((k) => k.startsWith("email"))) out.push("email");
  if (keys.some((k) => k.startsWith("whatsapp"))) out.push("whatsapp");
  if (keys.some((k) => k.startsWith("sms")) && !off.has("sms_provider")) out.push("sms");
  return out;
}
function runsLine(m: AgentManifest): string {
  const every = cronEvery(m);
  if (every === null) return "Runs when you start it";
  if (every % 1440 === 0) return every === 1440 ? "Runs every day" : `Runs every ${every / 1440} days`;
  if (every % 60 === 0) return every === 60 ? "Runs every hour" : `Runs every ${every / 60} hours`;
  return `Runs every ${every} minutes`;
}

const ICONS: Record<string, LucideIcon> = { finance: Wallet, payments: Wallet, sales: TrendingUp, marketing: Megaphone, support: MessageCircle, operations: Package, orders: Package, data: FileSpreadsheet };
function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = ICONS[category.toLowerCase()] ?? Bot;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
const TONES = ["#0F3D33", "#3B3486", "#7A3E12", "#124C6B", "#5B2A4A", "#2F4F1F"];
const toneFor = (category: string) => TONES[[...category].reduce((t, c) => t + c.charCodeAt(0), 0) % TONES.length];

/* Filters, kept in the address so a view can be shared and Back works ---------------------- */

type View = "all" | "live" | "soon" | "added" | "new";
type Sort = "recommended" | "name" | "credits";
const VIEWS: { id: View; label: string; signedIn?: boolean }[] = [
  { id: "all", label: "All agents" },
  { id: "live", label: "Live now" },
  { id: "soon", label: "Coming soon" },
  { id: "added", label: "Added by you", signedIn: true },
  { id: "new", label: "Not added yet", signedIn: true },
];
const SORTS: { value: Sort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "credits", label: "Most free credits" },
  { value: "name", label: "Name, A to Z" },
];

interface Filters {
  q: string;
  view: View;
  cat?: string;
  src?: Source;
  ch?: Channel;
  sort: Sort;
}

function useFilters(): [Filters, (p: Partial<Filters>) => void, () => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const f: Filters = {
    q: params.get("q") ?? "",
    view: (VIEWS.some((v) => v.id === params.get("view")) ? params.get("view") : "all") as View,
    cat: params.get("cat") ?? undefined,
    src: (params.get("src") ?? undefined) as Source | undefined,
    ch: (params.get("ch") ?? undefined) as Channel | undefined,
    sort: (SORTS.some((s) => s.value === params.get("sort")) ? params.get("sort") : "recommended") as Sort,
  };
  const write = (next: Filters) => {
    const q = new URLSearchParams(params.toString());
    const put = (k: string, v: string | undefined, dflt?: string) => (v && v !== dflt ? q.set(k, v) : q.delete(k));
    put("q", next.q.trim() ? next.q : undefined);
    put("view", next.view, "all");
    put("cat", next.cat);
    put("src", next.src);
    put("ch", next.ch);
    put("sort", next.sort, "recommended");
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };
  return [f, (p) => write({ ...f, ...p }), () => write({ q: "", view: "all", sort: f.sort })];
}

/* The card -------------------------------------------------------------------------------- */

function AgentCard({ a, instance, inApp }: { a: AgentListing; instance?: AgentInstance; inApp: boolean }) {
  const live = a.status === "live" && a.enabled && !!a.manifest;
  const m = a.manifest;
  const tone = toneFor(a.category);
  const sources = sourcesOf(m);
  const channels = channelsOf(m);
  // In the app, an agent's page and its launch stay inside the app's menu and top bar
  const details = inApp ? `/marketplace/agents/${a.id}` : `/agents/${a.id}`;
  const cta = instance
    ? { href: instance.status === "setup" ? `/agents/my/${instance.id}/setup` : `/agents/my/${instance.id}`, label: instance.status === "setup" ? "Finish setup" : "Open" }
    : live
      ? { href: inApp ? `/marketplace/agents/${a.id}/launch` : details, label: inApp ? "Launch agent" : "Try free" }
      : { href: details, label: "I need this" };

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border bg-surface shadow-sm transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg motion-reduce:hover:translate-y-0">
      <div className="relative flex aspect-[16/7] items-end justify-between p-4 text-white" style={{ background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 55%, black))` }}>
        <span aria-hidden className="pointer-events-none absolute -top-6 -right-6 size-32 rounded-full bg-white/10" />
        <span className="grid size-12 place-items-center rounded-control bg-white/15 backdrop-blur">
          <CategoryIcon category={a.category} className="size-6" />
        </span>
        <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold backdrop-blur">{a.category}</span>
        <span className="absolute top-3 left-3">
          {instance ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-success shadow-sm"><Check className="size-3.5" aria-hidden /> Added</span>
          ) : live ? (
            <StatusPill status="live" label="Live" tone="success" />
          ) : (
            <StatusPill status="coming_soon" />
          )}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-sans text-lg leading-snug font-bold tracking-normal">
            {/* The whole card opens the agent's page; the button below stays its own target */}
            <Link href={details} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-primary">
              {a.name}
            </Link>
          </h2>
          <p className="line-clamp-2 text-sm text-muted-foreground">{a.tagline}</p>
        </div>
        {m ? (
          <dl className="flex flex-col gap-1.5 text-xs">
            {sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <dt className="text-muted-foreground">Works with</dt>
                {sources.map((s) => <dd key={s} className="rounded-full border px-2 py-0.5">{SOURCES[s]}</dd>)}
              </div>
            )}
            {channels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <dt className="text-muted-foreground">Sends by</dt>
                {channels.map((c) => <dd key={c} className="rounded-full border px-2 py-0.5">{CHANNELS[c]}</dd>)}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <dt className="sr-only">Schedule</dt>
              <dd className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {runsLine(m)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">Tell us you want it and we&apos;ll email you the day it opens.</p>
        )}
        <div className="mt-auto flex flex-col gap-3">
          {m && (
            <div className="grid grid-cols-2 gap-2 rounded-control bg-surface-sunken p-3 text-center">
              <div>
                <p className="flex items-center justify-center gap-1 text-[0.6875rem] text-muted-foreground"><Sparkles className="size-3 text-accent" aria-hidden /> Free to start</p>
                <p className="text-sm font-bold">{m.trial.credits} credits</p>
              </div>
              <div>
                <p className="flex items-center justify-center gap-1 text-[0.6875rem] text-muted-foreground"><Coins className="size-3 text-accent" aria-hidden /> Then</p>
                <p className="text-sm font-bold">{PER_CREDIT}<span className="font-normal text-muted-foreground">/credit</span></p>
              </div>
            </div>
          )}
          <Button asChild variant={instance || live ? "primary" : "secondary"} className="relative z-10 w-full">
            <Link href={cta.href}>
              {cta.label} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

/* The marketplace ------------------------------------------------------------------------- */

/**
 * Agents as cards. In the app (`inApp`) the top bar's search box drives `?q=` and the list knows
 * which agents this workspace has subscribed to; outside it (the public catalog) it has its own box.
 * Sort and the public page's views stay in the address so a view can be shared and Back works.
 */
export function AgentMarket({ inApp = false }: { inApp?: boolean }) {
  const { data, loading, error, reload } = useApi(getCatalog, []);
  const mine = useApi(() => (inApp ? getMyAgents() : Promise.resolve([] as AgentInstance[])), [inApp], { live: inApp });
  const [f, set, clear] = useFilters();
  // The public page's box answers each key at once; the address follows
  const [typed, setTyped] = useState(f.q);
  const q = inApp ? f.q : typed;
  const added = useMemo(() => new Map((mine.data ?? []).map((i) => [i.agentId, i])), [mine.data]);
  const all = useMemo(() => data ?? [], [data]);
  const isLive = (a: AgentListing) => a.status === "live" && a.enabled && !!a.manifest;

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = all.filter((a) => words.every((w) => `${a.name} ${a.tagline} ${a.description} ${a.category}`.toLowerCase().includes(w)));
    const rank = (a: AgentListing) => (added.has(a.id) ? 2 : isLive(a) ? 1 : 0);
    return [...list].sort((x, y) =>
      f.sort === "name" ? x.name.localeCompare(y.name) : f.sort === "credits" ? (y.manifest?.trial.credits ?? 0) - (x.manifest?.trial.credits ?? 0) : rank(y) - rank(x)
    );
  }, [all, f.sort, q, added]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {!inApp && (
          <div className="relative min-w-0 flex-1 basis-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" aria-label="Search agents" placeholder="Search agents" value={typed} onChange={(e) => { setTyped(e.target.value); set({ q: e.target.value }); }} className="pl-9" />
          </div>
        )}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading && !data ? "Loading agents…" : q.trim() ? `${shown.length} ${shown.length === 1 ? "agent" : "agents"} for “${q.trim()}”` : `${shown.length} ${shown.length === 1 ? "agent" : "agents"}`}
        </p>
        <Label htmlFor="am-sort" className="sr-only">Sort by</Label>
        <Select value={f.sort} onValueChange={(v) => set({ sort: v as Sort })}>
          <SelectTrigger id="am-sort" className="ml-auto w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div aria-live="polite">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
            {[0, 1, 2].map((i) => <li key={i}><Skeleton className="h-[26rem] rounded-card" /></li>)}
          </ul>
        ) : shown.length ? (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-label="Agents">
            {shown.map((a) => <li key={a.id}><AgentCard a={a} instance={added.get(a.id)} inApp={inApp} /></li>)}
          </ul>
        ) : (
          <EmptyState
            icon={Sparkles}
            title={all.length ? `No agent matches “${q.trim()}”.` : "No agents yet."}
            body={all.length ? "Try another word." : "The first ones are on their way."}
            action={all.length ? <Button variant="secondary" onClick={() => { setTyped(""); clear(); }}>Clear search</Button> : undefined}
          />
        )}
      </div>
    </>
  );
}
