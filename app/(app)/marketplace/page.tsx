"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Plus, Tag } from "lucide-react";
import { AgentMarket } from "@/components/agents/catalog";
import { AgentsHome } from "@/components/agents/agents-home";
import { PostAgentDialog } from "@/components/agents/post-agent";
import { DealCard, SpotlightCard, type Show } from "@/components/marketplace/deal-card";
import { DealEditor, MyDeals } from "@/components/marketplace/my-deals";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getMyAgents } from "@/lib/api/agents";
import { getMarketplace, getMyDeals, getProducts, getRates, type Deal, type SortKey } from "@/lib/api";
import { can } from "@/lib/team";
import { canConvert } from "@/lib/fx";
import { CURRENCIES } from "@/lib/money";
import type { CurrencyCode, Store as StoreT } from "@/lib/types";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "sold", label: "Most sold" },
  { value: "revenue", label: "Highest revenue" },
  { value: "discount", label: "Biggest discount" },
  { value: "newest", label: "Newest" },
  { value: "ending", label: "Ending soon" },
];

/**
 * Inside the creator app (sign-in required), and open to sellers worldwide. Agents that work for the
 * store, and deals from sellers on PowerProof: one-time products and subscriptions, digital and
 * physical. Prices can be viewed in your own currency when exchange rates are loaded.
 */
export default function MarketplacePage() {
  return (
    <Suspense>
      <Marketplace />
    </Suspense>
  );
}

type View = "agents" | "subscribed" | "deals" | "mine";

/**
 * One marketplace with two tabs, Agents and Deals. The buttons at the top right follow the tab:
 * on Agents, "Subscribed agents" (this workspace's agents, their queue and credits) and "Post agent";
 * on Deals, "My deals" (this store's listings) and "List a deal". Listing and editing a deal happen
 * here too (?tab=mine&new=1, ?tab=mine&deal=<id>). The top bar's search box searches the tab.
 */
function Marketplace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const store = useCurrentStore();
  const [posting, setPosting] = useState(false);
  // Listing deals is for people who work on the store's offers; agents for owners and admins
  const canList = can(store.data?.access, "marketing");
  const canAgents = can(store.data?.access, "agents");
  const asked = params.get("tab");
  // "my-agents" is the old name of Subscribed agents: old links keep working
  const view: View = asked === "deals" ? "deals" : asked === "mine" && canList ? "mine" : (asked === "subscribed" || asked === "my-agents") && canAgents ? "subscribed" : "agents";
  const side: "agents" | "deals" = view === "deals" || view === "mine" ? "deals" : "agents";
  const editing = view === "mine" ? (params.get("new") === "1" ? "new" : params.get("deal") ?? undefined) : undefined;
  // Switching views keeps what's typed in the search box
  const go = (q: string) => {
    const s = new URLSearchParams(q);
    const typed = params.get("q");
    if (typed) s.set("q", typed);
    const out = s.toString();
    router.replace(out ? `${pathname}?${out}` : pathname, { scroll: false });
  };
  const mine = useApi(getMyDeals, [], { live: true });
  const myAgents = useApi(() => (canAgents ? getMyAgents() : Promise.resolve([])), [canAgents], { live: true });
  const products = useApi(() => getProducts(), [], { live: true });

  if (editing)
    return (
      <>
        <title>Marketplace · PowerProof</title>
        <PageHeader back={{ href: "/marketplace?tab=mine", label: "My deals" }} title={editing === "new" ? "List a deal" : "Edit deal"} />
        <DealEditor dealId={editing === "new" ? undefined : editing} deals={mine} products={products} store={store} onDone={() => go("tab=mine")} />
      </>
    );

  const count = (n: number | undefined) => n !== undefined && <span className="rounded-full bg-black/10 px-2 py-0.5 font-mono text-[0.6875rem] dark:bg-white/15">{n}</span>;
  const actions =
    side === "agents" ? (
      <>
        {canAgents && (
          <Button variant={view === "subscribed" ? "primary" : "secondary"} aria-pressed={view === "subscribed"} onClick={() => go(view === "subscribed" ? "" : "tab=subscribed")}>
            <BadgeCheck aria-hidden /> Subscribed agents {count(myAgents.data?.length)}
          </Button>
        )}
        <Button variant={view === "subscribed" ? "secondary" : "primary"} onClick={() => setPosting(true)}>
          <Plus aria-hidden /> Post agent
        </Button>
      </>
    ) : canList ? (
      <>
        <Button variant={view === "mine" ? "primary" : "secondary"} aria-pressed={view === "mine"} onClick={() => go(view === "mine" ? "tab=deals" : "tab=mine")}>
          <Tag aria-hidden /> My deals {count(mine.data?.length)}
        </Button>
        <Button variant={view === "mine" ? "secondary" : "primary"} onClick={() => go("tab=mine&new=1")}>
          <Plus aria-hidden /> List a deal
        </Button>
      </>
    ) : null;

  return (
    <>
      <title>Marketplace · PowerProof</title>
      <PageHeader title={view === "subscribed" ? "Subscribed agents" : view === "mine" ? "My deals" : "Marketplace"} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b">
        <StatusTabs
          label="Marketplace"
          className="mb-0 border-b-0"
          value={side}
          onChange={(v) => go(v === "agents" ? "" : "tab=deals")}
          tabs={[
            { value: "agents", label: "Agents" },
            { value: "deals", label: "Deals" },
          ]}
        />
        {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2 pb-2">{actions}</div>}
      </div>
      {view === "mine" ? (
        <MyDeals deals={mine} products={products.data} store={store.data} onNew={() => go("tab=mine&new=1")} onEdit={(id) => go(`tab=mine&deal=${id}`)} />
      ) : view === "subscribed" ? (
        <AgentsHome embedded />
      ) : view === "deals" ? (
        <Browse store={store.data} canList={canList} onNew={() => go("tab=mine&new=1")} />
      ) : (
        <AgentMarket inApp />
      )}
      <PostAgentDialog open={posting} onOpenChange={setPosting} />
    </>
  );
}

/** Every live deal: best sellers first, then the rest. The top bar's search box filters them (?q=). */
function Browse({ store, canList, onNew }: { store: StoreT | undefined; canList: boolean; onNew: () => void }) {
  const params = useSearchParams();
  const search = params.get("q")?.trim() ?? "";
  const [sort, setSort] = useState<SortKey>("sold");
  const [pick, setPick] = useState<CurrencyCode>();
  const { data, loading, error, reload } = useApi(() => getMarketplace({ sort, search: search || undefined, limit: 96 }), [sort, search], { live: true });
  const rates = useApi(getRates, []);

  const home = store?.currency;
  const convertible = !!home && !!rates.data && canConvert(rates.data, home);
  const show: Show | undefined = convertible && rates.data ? { currency: pick ?? home!, rates: rates.data } : undefined;
  const deals = useMemo(() => data ?? [], [data]);

  // The best sellers get the big cards, when nothing is being searched for
  const spotlight: Deal[] = useMemo(() => (!search && sort === "sold" ? deals.filter((d) => d.sold > 0).slice(0, 2) : []), [search, sort, deals]);
  const rest = deals.filter((d) => !spotlight.includes(d));
  const n = `${deals.length} ${deals.length === 1 ? "deal" : "deals"}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading && !data ? "Loading deals…" : search ? `${n} for “${search}”` : n}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {convertible && home && (
            <>
              <Label htmlFor="f-cur" className="sr-only">Show prices in</Label>
              <Select value={pick ?? home} onValueChange={(v) => setPick(v as CurrencyCode)}>
                <SelectTrigger id="f-cur" className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(rates.data ?? {}) as CurrencyCode[]).sort().map((c) => <SelectItem key={c} value={c}>{c} · {CURRENCIES[c].name}</SelectItem>)}</SelectContent>
              </Select>
            </>
          )}
          <Label htmlFor="f-sort" className="sr-only">Sort by</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger id="f-sort" className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {show && show.currency !== home && <p className="w-full text-xs text-muted-foreground">Converted for reference. Sellers charge in their own currency.</p>}
      </div>

      <div aria-live="polite">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => <li key={i}><Skeleton className="h-[30rem] rounded-card" /></li>)}
          </ul>
        ) : deals.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={search ? `No deals match “${search}”.` : "No deals yet."}
            body={search ? "Try another word, or a seller's name." : "Be the first: list one of your products as a deal and sellers everywhere will see it."}
            action={search || !canList ? undefined : <Button onClick={onNew}>List a deal</Button>}
          />
        ) : (
          <>
            {spotlight.length > 0 && (
              <section aria-label="Best sellers" className="mb-8">
                <h2 className="mb-3 font-display text-2xl">Best sellers right now</h2>
                <ul className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {spotlight.map((d, i) => <li key={d.id}><SpotlightCard d={d} rank={i + 1} show={show} /></li>)}
                </ul>
              </section>
            )}
            {rest.length > 0 && (
              <section aria-label="Deals">
                {spotlight.length > 0 && <h2 className="mb-3 font-display text-2xl">All deals</h2>}
                <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-label="Deals">
                  {rest.map((d) => <li key={d.id}><DealCard d={d} show={show} /></li>)}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
