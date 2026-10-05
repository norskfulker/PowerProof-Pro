"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { SEARCH_TIPS } from "@/components/search/global-search";
import { ActionButtons, ContactLine, ResultRow, TYPE_ICONS } from "@/components/search/result-row";
import { useSearchActions } from "@/components/search/search-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/hooks/use-api";
import { TYPE_LABELS, search, searchStores } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { SearchResult, SearchType } from "@/lib/types";

const ANY = "any";
const DAYS = [
  [ANY, "Any time"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
  ["365", "Last year"],
] as const;

export default function AdminSearchPage() {
  return (
    <Suspense>
      <SearchScreen />
    </Suspense>
  );
}

function SearchScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const tab = (params.get("type") as SearchType | null) ?? "all";
  const status = params.get("status") ?? ANY;
  const days = params.get("days") ?? ANY;
  const store = params.get("store") ?? ANY;
  const [draft, setDraft] = useState(q);
  const [rev, setRev] = useState(0);

  const set = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === ANY || (k === "type" && v === "all")) p.delete(k);
      else p.set(k, v);
    }
    router.replace(`/admin/search?${p.toString()}`, { scroll: false });
  };

  const filters = useMemo(() => ({ status: status === ANY ? undefined : status, days: days === ANY ? undefined : Number(days), storeSlug: store === ANY ? undefined : store }), [status, days, store]);
  const { data, loading, error, reload } = useApi(() => search(q, { scope: "admin", filters, perGroup: 1000 }), [q, filters, rev]);
  const stores = useApi(searchStores, []);
  const { run, askReveal, revealed, dialogs } = useSearchActions(() => setRev((n) => n + 1));

  // Keep the box in sync when q changes from the palette or history
  useEffect(() => {
    const t = setTimeout(() => setDraft(q), 0);
    return () => clearTimeout(t);
  }, [q]);

  const all = useMemo(() => data?.groups.flatMap((g) => g.results) ?? [], [data]);
  const statuses = useMemo(() => [...new Set(all.map((r) => r.status).filter(Boolean) as string[])].sort(), [all]);
  const tabs = data?.groups ?? [];
  const activeTab = tab === "all" || tabs.some((g) => g.type === tab) ? tab : "all";

  const columns = useMemo<ColumnDef<SearchResult, unknown>[]>(
    () => [
      {
        id: "result",
        accessorFn: (r) => `${r.title} ${r.subtitle ?? ""}`,
        header: "Result",
        cell: ({ row }) => {
          const r = row.original;
          const Icon = TYPE_ICONS[r.type];
          return (
            <Link href={r.href} className="flex min-h-11 min-w-0 items-start gap-2.5 hover:underline">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium [overflow-wrap:anywhere]">{r.title}</span>
                {r.subtitle && <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{r.subtitle}</span>}
              </span>
            </Link>
          );
        },
      },
      { id: "type", accessorFn: (r) => TYPE_LABELS[r.type], header: "Type" },
      { accessorKey: "storeName", header: "Store", cell: ({ getValue }) => <span className="[overflow-wrap:anywhere]">{(getValue() as string) ?? "—"}</span> },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => (getValue() ? <StatusPill status={getValue() as string} /> : "—") },
      { id: "date", accessorFn: (r) => r.date ?? "", header: "Date", enableSorting: true, cell: ({ row }) => (row.original.date ? formatDate(row.original.date) : "—") },
      { id: "amount", accessorFn: (r) => r.amount?.amount ?? 0, header: "Amount", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => (row.original.amount ? <MoneyText value={row.original.amount} mono /> : "—") },
      { id: "contact", header: "Contact", cell: ({ row }) => <ContactLine result={row.original} revealed={revealed} onReveal={(f) => askReveal(row.original, f)} /> },
      { id: "actions", header: () => <span className="sr-only">Actions</span>, meta: { align: "right" }, cell: ({ row }) => <ActionButtons result={row.original} onAction={(a) => run(a, row.original)} className="justify-end" /> },
    ],
    [revealed, askReveal, run]
  );

  const table = (rows: SearchResult[], label: string) => (
    <DataTable
      label={label}
      columns={columns}
      data={rows}
      searchPlaceholder="Filter these results"
      pageSize={20}
      noResults="Nothing in these results matches. Clear the filter box."
      mobileCard={(r) => (
        <div className="rounded-card border bg-surface p-4">
          <ResultRow result={r} revealed={revealed} onReveal={(f) => askReveal(r, f)} onAction={(a) => run(a, r)} showStore />
          <Button asChild size="sm" variant="secondary" className="mt-3">
            <Link href={r.href}>Open</Link>
          </Button>
        </div>
      )}
    />
  );

  return (
    <>
      <PageHeader title="Search" description="Every store, order, buyer and payout. Buyer contact details stay masked until you reveal them, and reveals are logged." />

      <form
        role="search"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: draft.trim(), type: undefined });
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="as-q">Search for</Label>
          <Input id="as-q" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="#1042, name@email.com, +91…, @store or words" />
        </div>
        <Button type="submit">
          <Search aria-hidden /> Search
        </Button>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="as-status">Status</Label>
          <Select value={status} onValueChange={(v) => set({ status: v })}>
            <SelectTrigger id="as-status" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              {[...new Set([...statuses, ...(status !== ANY ? [status] : [])])].map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="as-days">Date</Label>
          <Select value={days} onValueChange={(v) => set({ days: v })}>
            <SelectTrigger id="as-days" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{DAYS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="as-store">Store</Label>
          <Select value={store} onValueChange={(v) => set({ store: v })}>
            <SelectTrigger id="as-store" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All stores</SelectItem>
              {stores.data?.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6">
        {!q.trim() ? (
          <EmptyState
            icon={Search}
            title="Search the whole platform"
            body={
              <ul className="mt-1 flex flex-col gap-1 text-left">
                {SEARCH_TIPS.map(([ex, what]) => (
                  <li key={ex}><span className="font-mono text-xs">{ex}</span> for {what}</li>
                ))}
              </ul>
            }
          />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : data && data.total === 0 ? (
          <EmptyState icon={Search} title={`No results for “${q}”`} body="Check the spelling, clear a filter, or search by order number, email or phone." />
        ) : data ? (
          <Tabs value={activeTab} onValueChange={(v) => set({ type: v })}>
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              <TabsTrigger value="all">All {data.total}</TabsTrigger>
              {tabs.map((g) => (
                <TabsTrigger key={g.type} value={g.type}>{g.label} {g.total}</TabsTrigger>
              ))}
            </TabsList>
            <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
              {data.total} result{data.total === 1 ? "" : "s"} for “{q}”{data.pattern !== "text" ? `, read as ${data.pattern === "store" ? "a store" : `an ${data.pattern === "order" ? "order number" : data.pattern}`}` : ""}.
            </p>
            <TabsContent value="all" className="mt-4">{table(all, `All results for ${q}`)}</TabsContent>
            {tabs.map((g) => (
              <TabsContent key={g.type} value={g.type} className="mt-4">{table(g.results, `${g.label} for ${q}`)}</TabsContent>
            ))}
          </Tabs>
        ) : null}
      </div>
      {dialogs}
    </>
  );
}
