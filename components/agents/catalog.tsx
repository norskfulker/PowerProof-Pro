"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { StatusPill } from "@/components/pp/status-pill";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getCatalog, type AgentListing } from "@/lib/api/agents";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function priceLine(a: AgentListing): string | null {
  if (!a.plan) return null;
  const full = formatMoney({ amount: a.plan.priceMinor, currency: "INR" }).replace(/\.00$/, "");
  if (a.plan.launchPriceMinor !== null && a.plan.launchPriceMinor < a.plan.priceMinor) return `${formatMoney({ amount: a.plan.launchPriceMinor, currency: "INR" }).replace(/\.00$/, "")} first month, then ${full}/month`;
  return `${full}/month`;
}

function AgentCard({ a }: { a: AgentListing }) {
  const live = a.status === "live" && a.enabled;
  return (
    <li>
      <Link href={`/agents/${a.id}`} className="group flex h-full flex-col rounded-card border bg-surface p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-primary/40 hover:shadow-lift">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">{a.category}</span>
          {live ? <StatusPill status="live" label={a.manifest ? `${a.manifest.trial.credits} free credits` : "Live"} tone="brass" /> : <StatusPill status="coming_soon" />}
        </div>
        <h2 className="mt-3 text-xl">{a.name}</h2>
        <p className="mt-1 flex-1 text-muted-foreground">{a.tagline}</p>
        <span className={cn("mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold", live ? "text-primary" : "text-foreground")}>
          {live ? "Try free" : "I need this"} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

/** The public catalog: search and categories; live agents first */
export function Catalog() {
  const { data, loading, error, reload } = useApi(getCatalog, []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const categories = useMemo(() => ["All", ...new Set((data ?? []).map((a) => a.category))], [data]);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (data ?? [])
      .filter((a) => cat === "All" || a.category === cat)
      .filter((a) => words.every((w) => `${a.name} ${a.tagline} ${a.description} ${a.category}`.toLowerCase().includes(w)))
      .sort((x, y) => Number(y.status === "live") - Number(x.status === "live"));
  }, [data, q, cat]);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="Search agents" placeholder="Search: payments, orders, leads…" className="h-12 pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Categories">
        {categories.map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors", cat === c ? "border-foreground bg-foreground text-background" : "bg-surface hover:border-foreground/30")}>
            {c}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Skeleton className="h-48 rounded-card" />
            </li>
          ))}
        </ul>
      ) : shown.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => (
            <AgentCard key={a.id} a={a} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={Sparkles} title={data?.length ? "No agent matches that." : "No agents yet."} body={data?.length ? "Try another word, or pick All." : "The first ones are on their way."} />
      )}
    </div>
  );
}
