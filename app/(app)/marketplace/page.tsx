"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, RotateCcw, Search, SlidersHorizontal, Tag } from "lucide-react";
import { DealCard, SpotlightCard, type Show } from "@/components/marketplace/deal-card";
import { DealEditor, MyDeals } from "@/components/marketplace/my-deals";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { StatCard } from "@/components/pp/stat-card";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getMarketplace, getMyDeals, getProducts, getRates, type Deal, type MarketFilters, type SortKey } from "@/lib/api";
import { can } from "@/lib/team";
import { COUNTRIES, flagOf } from "@/lib/countries";
import { canConvert } from "@/lib/fx";
import { formatNumber } from "@/lib/format";
import { CURRENCIES } from "@/lib/money";
import type { CurrencyCode, Store as StoreT } from "@/lib/types";
import { cn } from "@/lib/utils";

const ANY = "any";
const KINDS = ["ebook", "template", "preset", "notion", "course", "audio", "other"] as const;
const SORTS: { value: SortKey; label: string }[] = [
  { value: "sold", label: "Most sold" },
  { value: "revenue", label: "Highest revenue" },
  { value: "discount", label: "Biggest discount" },
  { value: "newest", label: "Newest" },
  { value: "ending", label: "Ending soon" },
];
const cap = (s: string) => (s === "notion" ? "Notion" : s[0].toUpperCase() + s.slice(1));

/** One-tap views along the top; the finer filters sit under "Filters" */
const QUICK: { id: string; label: string; apply: Partial<MarketFilters>; match: (f: MarketFilters) => boolean }[] = [
  { id: "all", label: "Everything", apply: { fulfilment: undefined, billing: undefined, badge: undefined }, match: (f) => !f.fulfilment && !f.billing && !f.badge },
  { id: "digital", label: "Digital", apply: { fulfilment: "digital", billing: undefined, badge: undefined }, match: (f) => f.fulfilment === "digital" && !f.billing && !f.badge },
  { id: "physical", label: "Physical", apply: { fulfilment: "physical", billing: undefined, badge: undefined }, match: (f) => f.fulfilment === "physical" && !f.billing && !f.badge },
  { id: "subs", label: "Subscriptions", apply: { fulfilment: undefined, billing: "subscription", badge: undefined }, match: (f) => f.billing === "subscription" && !f.fulfilment && !f.badge },
  { id: "once", label: "One-time", apply: { fulfilment: undefined, billing: "one_time", badge: undefined }, match: (f) => f.billing === "one_time" && !f.fulfilment && !f.badge },
  { id: "verified", label: "Verified", apply: { fulfilment: undefined, billing: undefined, badge: "verified" }, match: (f) => f.badge === "verified" && !f.fulfilment && !f.billing },
];

/**
 * Inside the creator app (sign-in required), and open to sellers worldwide. Deals from sellers on
 * PowerProof: one-time products and subscriptions, digital and physical. Each card shows the
 * original and the deal price, the seller's country and trust badges, units sold and (when
 * shared) revenue. Prices can be viewed in your own currency when exchange rates are loaded.
 */
export default function MarketplacePage() {
  return (
    <Suspense>
      <Marketplace />
    </Suspense>
  );
}

/**
 * One page, laid out like the rest of the app: Browse (every live deal) and My deals (this store's
 * listings). Listing a deal and editing one happen here too, in place of the list
 * (?tab=mine&new=1, ?tab=mine&deal=<id>), so nothing opens a separate screen.
 */
function Marketplace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const store = useCurrentStore();
  // Listing deals is for people who work on the store's offers
  const canList = can(store.data?.access, "marketing");
  const tab: "browse" | "mine" = params.get("tab") === "mine" && canList ? "mine" : "browse";
  const editing = tab === "mine" ? (params.get("new") === "1" ? "new" : params.get("deal") ?? undefined) : undefined;
  const go = (q: string) => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  const mine = useApi(getMyDeals, [], { live: true });
  const products = useApi(() => getProducts(), [], { live: true });

  const header = editing ? (
    <PageHeader
      back={{ href: "/marketplace?tab=mine", label: "My deals" }}
      title={editing === "new" ? "List a deal" : "Edit deal"}
    />
  ) : (
    <PageHeader
      title="Marketplace"
      actions={canList ? <Button onClick={() => go("tab=mine&new=1")}><Plus aria-hidden /> List a deal</Button> : undefined}
    />
  );

  return (
    <>
      <title>Marketplace · PowerProof</title>
      {header}
      {!editing && (
        <StatusTabs
          label="Marketplace"
          value={tab}
          onChange={(v) => go(v === "mine" ? "tab=mine" : "")}
          tabs={[{ value: "browse", label: "Browse" }, ...(canList ? [{ value: "mine" as const, label: "My deals", count: mine.data?.length }] : [])]}
        />
      )}
      {editing ? (
        <DealEditor dealId={editing === "new" ? undefined : editing} deals={mine} products={products} store={store} onDone={() => go("tab=mine")} />
      ) : tab === "mine" ? (
        <MyDeals deals={mine} products={products.data} store={store.data} onNew={() => go("tab=mine&new=1")} onEdit={(id) => go(`tab=mine&deal=${id}`)} />
      ) : (
        <Browse store={store.data} canList={canList} onNew={() => go("tab=mine&new=1")} />
      )}
    </>
  );
}

/** Every live deal: quick views, filters, best sellers and the rest */
function Browse({ store, canList, onNew }: { store: StoreT | undefined; canList: boolean; onNew: () => void }) {
  const [f, setF] = useState<MarketFilters>({ sort: "sold" });
  const [text, setText] = useState({ min: "", max: "" });
  const [more, setMore] = useState(false);
  const [pick, setPick] = useState<CurrencyCode>();
  const set = (p: Partial<MarketFilters>) => setF((c) => ({ ...c, ...p }));
  const key = JSON.stringify(f);
  const { data, loading, error, reload } = useApi(() => getMarketplace({ ...f, limit: 96 }), [key], { live: true });
  const rates = useApi(getRates, []);

  const home = store?.currency;
  const convertible = !!home && !!rates.data && canConvert(rates.data, home);
  const show: Show | undefined = convertible && rates.data ? { currency: pick ?? home!, rates: rates.data } : undefined;

  const finer = [f.kind, f.country, f.min != null, f.max != null, f.badge && !QUICK.some((q) => q.id === "verified" && q.match(f))].filter(Boolean).length;
  const filtered = Boolean(f.search || f.fulfilment || f.billing || f.kind || f.country || f.min != null || f.max != null || f.badge);
  const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) || Number(v) < 0 ? undefined : Number(v));
  const deals = useMemo(() => data ?? [], [data]);

  // The best sellers get the big cards, when nothing is being searched for
  const spotlight: Deal[] = useMemo(() => (!filtered && (f.sort ?? "sold") === "sold" ? deals.filter((d) => d.sold > 0).slice(0, 2) : []), [filtered, f.sort, deals]);
  const rest = deals.filter((d) => !spotlight.includes(d));
  const stats = useMemo(() => ({ deals: deals.length, sellers: new Set(deals.map((d) => d.storeSlug)).size, countries: new Set(deals.map((d) => d.country)).size, sold: deals.reduce((t, d) => t + d.sold, 0) }), [deals]);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Deals live" value={formatNumber(stats.deals)} loading={loading && !data} />
        <StatCard label="Sellers" value={formatNumber(stats.sellers)} loading={loading && !data} />
        <StatCard label="Countries" value={formatNumber(stats.countries)} loading={loading && !data} />
        <StatCard label="Units sold" value={formatNumber(stats.sold)} loading={loading && !data} />
      </div>
      <div className="sticky top-2 z-20 mb-6 flex flex-col gap-3 rounded-card border bg-surface/95 p-3 shadow-sm backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label="Search the marketplace" placeholder="Search deals or sellers" value={f.search ?? ""} onChange={(e) => set({ search: e.target.value })} className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Quick views" className="flex w-full min-w-0 gap-2 overflow-x-auto pb-0.5 2xl:w-auto 2xl:flex-1">
            {QUICK.map((q) => (
              <button key={q.id} type="button" aria-pressed={q.match(f)} onClick={() => set(q.apply)} className={cn("min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors pointer-coarse:min-h-11", q.match(f) ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:border-primary")}>
                {q.label}
              </button>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" className="max-2xl:ml-auto" aria-expanded={more} aria-controls="mp-filters" onClick={() => setMore((m) => !m)}>
            <SlidersHorizontal aria-hidden /> Filters{finer > 0 && <span className="ml-1 grid size-5 place-items-center rounded-full bg-primary text-[0.6875rem] text-primary-foreground">{finer}</span>}
          </Button>
          <div className="flex items-center gap-2">
            <Label htmlFor="f-sort" className="sr-only">Sort by</Label>
            <Select value={f.sort ?? "sold"} onValueChange={(v) => set({ sort: v as SortKey })}>
              <SelectTrigger id="f-sort" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {more && (
          <div id="mp-filters" className="grid grid-cols-1 gap-4 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-kind">Category</Label>
              <Select value={f.kind ?? ANY} onValueChange={(v) => set({ kind: v === ANY ? undefined : (v as MarketFilters["kind"]), fulfilment: v === ANY ? f.fulfilment : "digital" })}>
                <SelectTrigger id="f-kind" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>All categories</SelectItem>{KINDS.map((k) => <SelectItem key={k} value={k}>{cap(k)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-country">Seller&apos;s country</Label>
              <Select value={f.country ?? ANY} onValueChange={(v) => set({ country: v === ANY ? undefined : v })}>
                <SelectTrigger id="f-country" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>Anywhere in the world</SelectItem>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{flagOf(c.code)} {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-badge">Trust</Label>
              <Select value={f.badge ?? ANY} onValueChange={(v) => set({ badge: v === ANY ? undefined : (v as "verified" | "trusted") })}>
                <SelectTrigger id="f-badge" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>Any seller</SelectItem><SelectItem value="verified">Verified by PowerProof</SelectItem><SelectItem value="trusted">Trusted sellers</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-min">Price from</Label>
                <Input id="f-min" inputMode="decimal" className="w-24" value={text.min} placeholder="0" onChange={(e) => { setText({ ...text, min: e.target.value }); set({ min: num(e.target.value) }); }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-max">to</Label>
                <Input id="f-max" inputMode="decimal" className="w-24" value={text.max} placeholder="Any" onChange={(e) => { setText({ ...text, max: e.target.value }); set({ max: num(e.target.value) }); }} />
              </div>
            </div>
          </div>
        )}

        {(convertible || filtered) && (
          <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
            {convertible && home && (
              <div className="flex items-center gap-2">
                <Label htmlFor="f-cur">Show prices in</Label>
                <Select value={pick ?? home} onValueChange={(v) => setPick(v as CurrencyCode)}>
                  <SelectTrigger id="f-cur" className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(rates.data ?? {}) as CurrencyCode[]).sort().map((c) => <SelectItem key={c} value={c}>{c} · {CURRENCIES[c].name}</SelectItem>)}</SelectContent>
                </Select>
                {show && show.currency !== home && <span className="text-muted-foreground">Converted for reference. Sellers charge in their own currency.</span>}
              </div>
            )}
            {filtered && (
              <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => { setF({ sort: f.sort }); setText({ min: "", max: "" }); }}>
                <RotateCcw aria-hidden /> Clear filters
              </Button>
            )}
          </div>
        )}
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
            title={filtered ? "No deals match those filters." : "No deals yet."}
            body={filtered ? "Try fewer filters, another country or a wider price range." : "Be the first: list one of your products as a deal and sellers everywhere will see it."}
            action={filtered || !canList ? undefined : <Button onClick={onNew}>List a deal</Button>}
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
