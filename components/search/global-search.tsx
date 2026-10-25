"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, Clock, CornerDownRight, Search, X } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { onDataChange, search } from "@/lib/api";
import { getCatalog, type AgentListing } from "@/lib/api/agents";
import type { SearchResponse, SearchResult, SearchScope } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNav } from "@/components/nav/use-nav";
import { navSearch } from "@/lib/nav/model";
import { ResultRow } from "./result-row";

const RECENT_MAX = 6;
const recentKey = (scope: SearchScope) => `pp:recent-search:${scope}`;

function readRecent(scope: SearchScope): string[] {
  try {
    return JSON.parse(localStorage.getItem(recentKey(scope)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function pushRecent(scope: SearchScope, q: string) {
  if (!q) return;
  try {
    const next = [q, ...readRecent(scope).filter((x) => x !== q)].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(scope), JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
}

const itemValue = (r: SearchResult) => `${r.type}:${r.id}`;
/** The platform never changes while the page is open */
const noSubscribe = () => () => {};
const useModKey = () => useSyncExternalStore(noSubscribe, () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform + " " + navigator.userAgent) ? "⌘" : "Ctrl"), () => "Ctrl");

/** Agents are read once per page load and matched in the browser */
let catalog: Promise<AgentListing[]> | undefined;
const agentsOnce = () => (catalog ??= getCatalog().catch(() => ((catalog = undefined), [])));

/** Results as you type: the workspace's records, pages from the menu, and agents */
function useLiveResults(scope: SearchScope, query: string, enabled: boolean) {
  const [data, setData] = useState<SearchResponse>();
  const [agents, setAgents] = useState<AgentListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [rev, setRev] = useState(0);
  const q = query.trim();

  // Data changed somewhere (this tab or another): search again so results stay current
  useEffect(() => onDataChange(() => setRev((n) => n + 1)), []);

  useEffect(() => {
    if (!enabled || scope !== "creator") return;
    let alive = true;
    agentsOnce().then((a) => alive && setAgents(a));
    return () => {
      alive = false;
    };
  }, [enabled, scope]);

  useEffect(() => {
    if (!enabled || !q) return;
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      search(q, { scope, perGroup: scope === "admin" ? 5 : 6 })
        .then((r) => {
          if (!alive) return;
          setData(r);
          setError(false);
        })
        .catch(() => alive && setError(true))
        .finally(() => alive && setLoading(false));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [enabled, q, scope, rev]);

  const nav = useNav(scope === "admin" ? "admin" : "creator");
  const pages = useMemo(() => (q ? navSearch([...nav.tree, ...nav.storeTabs], q, 5) : []), [nav.tree, nav.storeTabs, q]);
  const agentHits = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return agents.filter((a) => words.every((w) => `${a.name} ${a.tagline} ${a.category}`.toLowerCase().includes(w))).slice(0, 4);
  }, [agents, q]);
  // A result for an older query is never shown under a newer one
  const current = data && data.query.trim() === q ? data : undefined;
  return { data: current, pages, agents: agentHits, loading: !!q && (loading || !current) && !error, error, retry: () => setRev((n) => n + 1) };
}

const groupClass = "mb-1 [&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1";
const itemClass = "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-sm data-[selected=true]:bg-muted";

/** The list under the box: recent searches when empty, then live results */
function Results({ scope, query, setQuery, onPick }: { scope: SearchScope; query: string; setQuery: (q: string) => void; onPick: (href: string) => void }) {
  const hasQuery = query.trim().length > 0;
  const live = useLiveResults(scope, query, true);
  const [recent] = useState(() => readRecent(scope));
  const total = (live.data?.total ?? 0) + live.pages.length + live.agents.length;

  if (!hasQuery) {
    if (!recent.length) return <p className="px-3 py-6 text-center text-sm text-muted-foreground">{scope === "admin" ? "Search orders, stores and people." : "Search products, orders, buyers, pages and agents."}</p>;
    return (
      <CommandPrimitive.List aria-label="Recent searches">
        <CommandPrimitive.Group heading="Recent searches" className={groupClass}>
          {recent.map((r) => (
            <CommandPrimitive.Item key={r} value={`recent:${r}`} onSelect={() => setQuery(r)} className={itemClass}>
              <Clock className="size-4 text-muted-foreground" aria-hidden /> {r}
            </CommandPrimitive.Item>
          ))}
        </CommandPrimitive.Group>
      </CommandPrimitive.List>
    );
  }

  if (live.error)
    return (
      <p role="alert" className="px-3 py-6 text-center text-sm">
        Search didn&apos;t load.{" "}
        <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={live.retry}>
          Try again
        </button>
      </p>
    );

  return (
    <>
      {total > 0 && (
        <CommandPrimitive.List aria-label="Results">
          {live.pages.length > 0 && (
            <CommandPrimitive.Group heading="Go to" className={groupClass}>
              {live.pages.map((i) => (
                <CommandPrimitive.Item key={i.id} value={`page:${i.href}`} onSelect={() => onPick(i.href!)} className={itemClass}>
                  {i.icon ? <i.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <CornerDownRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{i.label}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{i.path.slice(0, -1).join(" › ")}</span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          )}
          {live.data?.groups.map((g) => (
            <CommandPrimitive.Group key={g.type} heading={`${g.label} · ${g.total}`} className={groupClass}>
              {g.results.map((r) => (
                <CommandPrimitive.Item key={itemValue(r)} value={itemValue(r)} onSelect={() => onPick(r.href)} className="flex min-h-11 cursor-pointer items-start rounded-control px-2 py-2 data-[selected=true]:bg-muted">
                  <ResultRow result={r} revealed={{}} onAction={() => {}} showActions={false} showStore={scope === "admin"} />
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          ))}
          {live.agents.length > 0 && (
            <CommandPrimitive.Group heading="Agents" className={groupClass}>
              {live.agents.map((a) => (
                <CommandPrimitive.Item key={a.id} value={`agent:${a.id}`} onSelect={() => onPick(`/marketplace/agents/${a.id}`)} className={itemClass}>
                  <Bot className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{a.category}</span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          )}
        </CommandPrimitive.List>
      )}
      {total === 0 && live.loading && (
        <div className="flex flex-col gap-2 p-2" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-control bg-muted" />)}
        </div>
      )}
      {total === 0 && !live.loading && (
        <div className="px-3 py-6 text-center">
          <p className="font-semibold">No results for “{query.trim()}”</p>
          <p className="mt-1 text-sm text-muted-foreground">Check the spelling, or try an order number, email or product name.</p>
        </div>
      )}
    </>
  );
}

/** On the Marketplace the one box searches agents and deals there, live, through the address (?q=) */
function MarketplaceBox({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [seen, setSeen] = useState(params.get("q") ?? "");
  // Back, Forward or a link changed the address: follow it
  const fromUrl = params.get("q") ?? "";
  if (fromUrl !== seen) {
    setSeen(fromUrl);
    setValue(fromUrl);
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const write = (v: string) => {
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = new URLSearchParams(params.toString());
      if (v.trim()) q.set("q", v);
      else q.delete("q");
      setSeen(v.trim() ? v : "");
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    }, 150);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const tab = params.get("tab");
  const what = tab === "deals" || tab === "mine" ? "deals" : "agents";
  return (
    <div className="relative w-full max-w-md min-w-0">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => write(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && (write(""), e.currentTarget.blur())}
        placeholder={`Search ${what}`}
        aria-label={`Search the marketplace's ${what}`}
        className="h-10 w-full rounded-control border bg-surface pr-9 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <Button variant="ghost" size="icon-sm" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => write("")} aria-label="Clear search">
          <X />
        </Button>
      )}
    </div>
  );
}

/**
 * The one search box, in the top bar of every page (⌘K on Mac, Ctrl K elsewhere). It answers as
 * you type, in a list under the box: the workspace's products, orders, buyers and more, pages from
 * the menu, and agents. On the Marketplace it searches the agents or deals on screen instead.
 * Admins search every store.
 */
export function GlobalSearch({ scope }: { scope: SearchScope }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const mod = useModKey();
  const market = scope === "creator" && pathname === "/marketplace";
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [sheet, setSheet] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // The box is hidden on phones: open the full-screen one there
        if (inputRef.current?.offsetParent) inputRef.current.focus();
        else setSheet(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (href: string) => {
    pushRecent(scope, query.trim());
    setFocused(false);
    setSheet(false);
    inputRef.current?.blur();
    router.push(href);
  };

  const placeholder = scope === "admin" ? "Search orders, stores, people" : "Search products, orders, buyers, agents";

  return (
    <>
      {market ? (
        <div className="flex w-full justify-center max-sm:hidden">
          <Suspense>
            <MarketplaceBox inputRef={inputRef} />
          </Suspense>
        </div>
      ) : (
        <div
          ref={boxRef}
          className="relative w-full max-w-md min-w-0 max-sm:hidden"
          onBlur={(e) => !boxRef.current?.contains(e.relatedTarget as Node | null) && setFocused(false)}
        >
          <CommandPrimitive shouldFilter={false} loop label="Search" className="relative">
            <div className={cn("flex h-10 items-center gap-2 rounded-control border bg-surface px-3", focused && "border-primary ring-2 ring-primary/20")}>
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <CommandPrimitive.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                onFocus={() => setFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    if (query) setQuery("");
                    else inputRef.current?.blur();
                  }
                }}
                placeholder={placeholder}
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <Button variant="ghost" size="icon-sm" className="-mr-1.5" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery("")} aria-label="Clear search">
                  <X />
                </Button>
              ) : (
                <kbd className="rounded-[4px] border bg-surface-sunken px-1.5 font-mono text-[0.625rem] text-muted-foreground">{mod} K</kbd>
              )}
            </div>
            {focused && (
              <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(70dvh,32rem)] overflow-y-auto overscroll-contain rounded-card border bg-popover p-1.5 text-popover-foreground shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                <Results scope={scope} query={query} setQuery={setQuery} onPick={pick} />
              </div>
            )}
          </CommandPrimitive>
        </div>
      )}

      <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setSheet(true)} aria-label="Search">
        <Search />
      </Button>
      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogContent bare className="top-[6dvh] max-h-[88dvh] translate-y-0 sm:max-w-[min(42rem,calc(100%-2rem))]" showCloseButton={false}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Results update as you type. Use the arrow keys to move and Enter to open.</DialogDescription>
          {market ? (
            <div className="p-3">
              <Suspense>
                <MarketplaceBox inputRef={sheetRef} />
              </Suspense>
            </div>
          ) : (
            <CommandPrimitive shouldFilter={false} loop label="Search" className="flex max-h-[88dvh] min-h-0 flex-col">
              <div className="flex items-center gap-2 border-b px-4">
                <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <CommandPrimitive.Input autoFocus value={query} onValueChange={setQuery} placeholder={placeholder} className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
                {query && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setQuery("")} aria-label="Clear search">
                    <X />
                  </Button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <Results scope={scope} query={query} setQuery={setQuery} onPick={pick} />
              </div>
            </CommandPrimitive>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
