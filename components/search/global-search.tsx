"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Eye, Loader2, Search, X } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CREATOR_TYPES, TYPE_LABELS, TYPE_ORDER, search } from "@/lib/api";
import type { SearchResponse, SearchResult, SearchScope, SearchType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, CREATOR_NAV } from "@/components/pp/nav-config";
import { ActionButtons, ResultRow } from "./result-row";
import { useSearchActions } from "./search-actions";

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
  try {
    const next = [q, ...readRecent(scope).filter((x) => x !== q)].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(scope), JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
}

const itemValue = (r: SearchResult) => `${r.type}:${r.id}`;

export const SEARCH_TIPS = [
  ["#1042", "an order number"],
  ["name@email.com", "a buyer or creator email"],
  ["+91 98765…", "a phone number"],
  ["@inkwell", "everything in one store"],
] as const;

/**
 * Global search palette (Ctrl K). Admins search every store with buyer contact masked; creators
 * search their own store. Up/Down move, Enter opens, Tab and Shift+Tab jump between groups,
 * Ctrl+Enter opens actions for the highlighted result, Esc closes.
 */
export function GlobalSearch({ scope }: { scope: SearchScope }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<SearchType[]>([]);
  const [data, setData] = useState<SearchResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [rev, setRev] = useState(0);
  const actionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { run, askReveal, revealed, dialogs } = useSearchActions(() => setRev((n) => n + 1));
  const typeChoices = scope === "admin" ? TYPE_ORDER : TYPE_ORDER.filter((t) => CREATOR_TYPES.includes(t));
  const allHref = (q: string, type?: SearchType) => `/admin/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search; state is only set from the timer and promise callbacks
  useEffect(() => {
    if (!open || !query.trim()) return;
    let alive = true;
    const t = setTimeout(() => {
      search(query, { scope, filters: { types }, perGroup: scope === "admin" ? 5 : 8 })
        .then((r) => {
          if (!alive) return;
          setData(r);
          setError(false);
          setActive(r.groups[0]?.results[0] ? itemValue(r.groups[0].results[0]) : "");
        })
        .catch(() => alive && setError(true))
        .finally(() => alive && setLoading(false));
    }, 140);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, query, types, scope, rev]);

  const flat = useMemo(() => data?.groups.flatMap((g) => g.results) ?? [], [data]);
  const current = flat.find((r) => itemValue(r) === active);
  const pages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (scope === "admin" ? ADMIN_NAV : CREATOR_NAV).flatMap((g) => g.items).filter((i) => !i.soon && i.label.toLowerCase().includes(q)).slice(0, 4);
  }, [query, scope]);
  const hasQuery = query.trim().length > 0;

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o) setRecent(readRecent(scope));
  }

  function onQuery(q: string) {
    setQuery(q);
    setLoading(!!q.trim());
    if (!q.trim()) setData(undefined);
  }

  function toggleType(t: SearchType) {
    setLoading(hasQuery);
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  function openResult(r: SearchResult) {
    pushRecent(scope, query.trim());
    setOpen(false);
    router.push(r.href);
  }

  function jumpGroup(dir: 1 | -1) {
    if (!data?.groups.length) return;
    const gi = Math.max(0, data.groups.findIndex((g) => g.results.some((r) => itemValue(r) === active)));
    const next = data.groups[(gi + dir + data.groups.length) % data.groups.length];
    setActive(itemValue(next.results[0]));
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => onOpenChange(true)}
        className="w-full max-w-sm min-w-0 shrink justify-start font-normal text-muted-foreground max-sm:hidden"
        aria-label="Search (Ctrl K)"
      >
        <Search aria-hidden />
        <span className="truncate">{scope === "admin" ? "Search orders, stores, people" : "Search products, orders, people"}</span>
        <kbd className="ml-auto rounded-[4px] border bg-surface-sunken px-1.5 font-mono text-[0.625rem]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => onOpenChange(true)} aria-label="Search">
        <Search />
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-[8dvh] max-h-[84dvh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[min(42rem,calc(100%-2rem))]" showCloseButton={false}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            {scope === "admin" ? "Search every store. Contact details are masked until revealed." : "Search your store."} Use arrow keys to move, Tab to jump between groups, Enter to open.
          </DialogDescription>
          <CommandPrimitive
            shouldFilter={false}
            loop
            value={active}
            onValueChange={setActive}
            label="Search results"
            className="flex max-h-[84dvh] min-h-0 min-w-0 flex-col"
            onKeyDown={(e) => {
              if (e.key === "Tab" && document.activeElement === inputRef.current && flat.length) {
                e.preventDefault();
                jumpGroup(e.shiftKey ? -1 : 1);
              } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && current) {
                e.preventDefault();
                actionsRef.current?.querySelector<HTMLElement>("button")?.focus();
              }
            }}
          >
            <div className="flex items-center gap-2 border-b px-4">
              {loading ? <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
              <CommandPrimitive.Input
                ref={inputRef}
                value={query}
                onValueChange={onQuery}
                placeholder={scope === "admin" ? "Order #, email, phone, @store or any words" : "Order #, buyer, product or code"}
                className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <Button variant="ghost" size="icon-sm" onClick={() => onQuery("")} aria-label="Clear search">
                  <X />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground">
                Esc
              </Button>
            </div>

            <div role="group" aria-label="Filter by type" className="flex gap-2 overflow-x-auto border-b px-4 py-2">
              {typeChoices.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={types.includes(t)}
                  onClick={() => toggleType(t)}
                  className={cn(
                    "inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap pointer-coarse:min-h-11",
                    types.includes(t) ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-busy={loading || undefined}>
              {((!hasQuery && recent.length > 0) || (hasQuery && !error && (!!data?.total || pages.length > 0))) && (
                <CommandPrimitive.List aria-label={hasQuery ? "Results" : "Recent searches"}>
                  {!hasQuery && (
                    <CommandPrimitive.Group heading="Recent searches" className="mb-2 [&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1">
                      {recent.map((r) => (
                        <CommandPrimitive.Item key={r} value={`recent:${r}`} onSelect={() => onQuery(r)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-sm data-[selected=true]:bg-muted">
                          <Clock className="size-4 text-muted-foreground" aria-hidden /> {r}
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                  )}
                  {pages.length > 0 && (
                    <CommandPrimitive.Group heading="Go to" className="mb-2 [&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                      {pages.map((i) => (
                        <CommandPrimitive.Item key={i.href} value={`page:${i.href}`} onSelect={() => { setOpen(false); router.push(i.href); }} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-sm data-[selected=true]:bg-muted">
                          <i.icon className="size-4 text-muted-foreground" aria-hidden /> {i.label}
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                  )}
                  {hasQuery &&
                    data?.groups.map((g) => (
                      <CommandPrimitive.Group key={g.type} heading={`${g.label} · ${g.total}`} className="mb-2 [&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                    {g.results.map((r) => (
                      <CommandPrimitive.Item key={itemValue(r)} value={itemValue(r)} onSelect={() => openResult(r)} className="flex min-h-11 cursor-pointer items-start rounded-control px-2 py-2 data-[selected=true]:bg-muted">
                        <ResultRow result={r} revealed={revealed} onAction={() => {}} showActions={false} showStore={scope === "admin"} />
                      </CommandPrimitive.Item>
                    ))}
                    {scope === "admin" && g.total > g.results.length && (
                      <CommandPrimitive.Item
                        value={`all:${g.type}`}
                        onSelect={() => {
                          pushRecent(scope, query.trim());
                          setOpen(false);
                          router.push(allHref(query.trim(), g.type));
                        }}
                        className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-primary data-[selected=true]:bg-muted"
                      >
                        See all {g.total} {g.label.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
                      </CommandPrimitive.Item>
                    )}
                  </CommandPrimitive.Group>
                    ))}
                </CommandPrimitive.List>
              )}
              {!hasQuery && (
                <div className="flex flex-col gap-4 px-2 py-2">
                  <div>
                    <p className="eyebrow px-2 pb-1">Try</p>
                    <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {SEARCH_TIPS.filter(([, w]) => scope === "admin" || !w.includes("store")).map(([ex, what]) => (
                        <li key={ex}>
                          <button type="button" onClick={() => onQuery(ex.replace("…", ""))} className="flex min-h-11 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-muted">
                            <span className="font-mono text-xs">{ex}</span> <span className="text-muted-foreground">for {what}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {hasQuery && error && (
                <p role="alert" className="px-3 py-8 text-center text-sm">
                  Search didn&apos;t load.{" "}
                  <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => setRev((n) => n + 1)}>
                    Try again
                  </button>
                </p>
              )}

              {hasQuery && !error && loading && !data && (
                <div className="flex flex-col gap-2 px-2 py-2" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} data-slot="skeleton" className="h-14 animate-pulse rounded-control bg-muted" />
                  ))}
                </div>
              )}

              {hasQuery && !error && data && data.total === 0 && pages.length === 0 && !loading && (
                <div className="px-3 py-10 text-center">
                  <p className="font-display text-lg font-extrabold">No results for “{query}”</p>
                  <p className="mt-1 text-sm text-muted-foreground">{types.length ? "Try removing a filter, or " : ""}Check the spelling, or search by order number, email or phone.</p>
                </div>
              )}

            </div>

            {current && (
              <div ref={actionsRef} role="group" aria-label={`Actions for ${current.title}`} className="flex flex-wrap items-center gap-2 border-t bg-surface-sunken px-4 py-2" onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), inputRef.current?.focus())}>
                <span className="mr-auto min-w-0 truncate text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{current.title}</span>
                </span>
                <Button size="sm" variant="primary" onClick={() => openResult(current)}>
                  Open
                </Button>
                {current.masked &&
                  (["email", "phone"] as const)
                    .filter((f) => current[f] && !revealed[`${current.type}:${current.id}:${f}`])
                    .map((f) => (
                      <Button key={f} size="sm" variant="ghost" onClick={() => askReveal(current, f)}>
                        <Eye aria-hidden /> Reveal {f}
                      </Button>
                    ))}
                <ActionButtons result={current} onAction={(a) => run(a, current)} />
              </div>
            )}
            <p className="hidden border-t px-4 py-2 text-xs text-muted-foreground md:block">
              <kbd className="font-mono">↑↓</kbd> move · <kbd className="font-mono">Enter</kbd> open · <kbd className="font-mono">Tab</kbd> next group · <kbd className="font-mono">Ctrl Enter</kbd> actions · <kbd className="font-mono">Esc</kbd> close
              {hasQuery && scope === "admin" && (
                <>
                  {" · "}
                  <a href={allHref(query.trim())} className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => pushRecent(scope, query.trim())}>
                    All results
                  </a>
                </>
              )}
            </p>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
      {dialogs}
    </>
  );
}
