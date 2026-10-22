"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Mail, MailCheck, Save, Tag, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { EmailComposer } from "@/components/customers/email-composer";
import { DataTable } from "@/components/pp/data-table";
import { EmptyState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusTabs } from "@/components/pp/status-tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { deleteSegment, getCustomers, getOrders, getProducts, getSegments, saveSegment, tagCustomers } from "@/lib/api";
import { countryShort, formatDate, initials, timeAgo } from "@/lib/format";
import { csvAmount, money } from "@/lib/money";
import type { Customer, CustomerSegment, SegmentRules } from "@/lib/types";

const DAY = 86_400_000;
const ANY = "any";

/** Ready-made views; saved ones follow them */
const READY: { id: string; name: string; rules: SegmentRules }[] = [
  { id: "all", name: "All", rules: { kind: "all" } },
  { id: "repeat", name: "Repeat buyers", rules: { kind: "repeat" } },
  { id: "lapsed", name: "Not back in 60 days", rules: { kind: "lapsed", days: 60 } },
  { id: "top", name: "Top spenders", rules: { kind: "top" } },
  { id: "subscribed", name: "Get your emails", rules: { kind: "subscribed" } },
];

/** Who fits a view. `buyersOf` is the emails that bought a product (for "bought…" views). */
function inSegment(list: Customer[], r: SegmentRules, now: number, buyersOf?: Set<string>): Customer[] {
  switch (r.kind) {
    case "repeat":
      return list.filter((c) => c.ordersCount > 1);
    case "lapsed":
      return list.filter((c) => now - Date.parse(c.lastOrderAt) > (r.days ?? 60) * DAY);
    case "top": {
      // The top tenth by what they've spent (at least one person)
      const n = Math.max(1, Math.ceil(list.length / 10));
      return [...list].sort((a, b) => b.totalSpent.amount - a.totalSpent.amount).slice(0, n);
    }
    case "subscribed":
      return list.filter((c) => c.subscribed);
    case "tag":
      return list.filter((c) => !!r.value && c.tags.includes(r.value));
    case "product":
      return buyersOf ? list.filter((c) => buyersOf.has(c.email.toLowerCase())) : [];
    default:
      return list;
  }
}

export default function CustomersPage() {
  const { data, loading, error, reload } = useApi(() => getCustomers(), [], { live: true });
  const saved = useApi(getSegments, []);
  const products = useApi(() => getProducts(), []);
  const [view, setView] = useState("all");
  const [extra, setExtra] = useState<SegmentRules | undefined>();
  const [composer, setComposer] = useState<Customer[] | null>(null);
  const [now] = useState(() => Date.now());

  const views: { id: string; name: string; rules: SegmentRules; saved?: CustomerSegment }[] = [...READY, ...(saved.data ?? []).map((s) => ({ id: s.id, name: s.name, rules: s.rules, saved: s }))];
  const current = extra ?? views.find((v) => v.id === view)?.rules ?? READY[0].rules;
  // "Bought this product": who, from the orders (loaded only when that view is open)
  const productId = current.kind === "product" ? current.value : undefined;
  const orders = useApi(() => (productId ? getOrders({ productId }) : Promise.resolve([])), [productId]);
  const buyersOf = useMemo(() => (productId && orders.data ? new Set(orders.data.filter((o) => o.status === "paid").map((o) => o.buyerEmail.toLowerCase())) : undefined), [productId, orders.data]);
  const rows = useMemo(() => (data ? inSegment(data, current, now, buyersOf) : undefined), [data, current, now, buyersOf]);
  const tags = useMemo(() => [...new Set((data ?? []).flatMap((c) => c.tags))].sort(), [data]);
  const countries = useMemo(() => [...new Set(data?.map((c) => c.countryCode))].map((c) => ({ value: c, label: countryShort(c) })), [data]);

  const columns = useMemo<ColumnDef<Customer, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (c) => `${c.name} ${c.email} ${c.tags.join(" ")}`,
        header: "Customer",
        cell: ({ row }) => (
          <Link href={`/sales/customers/${row.original.id}`} className="flex min-h-11 min-w-0 items-center gap-3">
            <Avatar className="size-9"><AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{initials(row.original.name)}</AvatarFallback></Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 font-medium hover:underline">
                {row.original.name}
                {row.original.subscribed && <MailCheck className="size-3.5 text-success" aria-label="Gets your emails" />}
              </span>
              <span className="text-xs text-muted-foreground">{row.original.email}</span>
              {row.original.tags.length > 0 && (
                <span className="mt-0.5 flex flex-wrap gap-1">{row.original.tags.map((t) => <span key={t} className="rounded-full bg-accent-soft px-1.5 py-px text-[0.6875rem] font-medium text-accent-ink">{t}</span>)}</span>
              )}
            </span>
          </Link>
        ),
      },
      { accessorKey: "countryCode", header: "Country", filterFn: "equals", cell: ({ getValue }) => countryShort(getValue() as string) },
      { accessorKey: "ordersCount", header: "Orders", enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-mono text-[0.8125rem]">{getValue() as number}</span> },
      { id: "spent", accessorFn: (c) => c.totalSpent.amount, header: "Spent", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={row.original.totalSpent} mono /> },
      { id: "avg", accessorFn: (c) => (c.ordersCount ? c.totalSpent.amount / c.ordersCount : 0), header: "Average order", enableSorting: true, meta: { align: "right" }, cell: ({ row }) => <MoneyText value={money(Math.round(row.original.totalSpent.amount / Math.max(1, row.original.ordersCount)), row.original.totalSpent.currency)} mono className="text-muted-foreground" /> },
      { id: "first", accessorFn: (c) => c.firstOrderAt, header: "Customer since", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.firstOrderAt)}</span> },
      { id: "last", accessorFn: (c) => c.lastOrderAt, header: "Last order", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap" title={formatDate(row.original.lastOrderAt, { time: true })}>{timeAgo(row.original.lastOrderAt)}</span> },
    ],
    []
  );

  async function saveView() {
    if (!extra) return;
    const name = extra.kind === "tag" ? `Tagged ${extra.value}` : `Bought ${products.data?.find((p) => p.id === extra.value)?.title ?? "a product"}`;
    try {
      const s = await saveSegment(name, extra);
      saved.reload();
      setExtra(undefined);
      setView(s.id);
      toast.success("View saved", { description: name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That view didn't save.");
    }
  }

  const active = views.find((v) => v.id === view);
  return (
    <>
      <PageHeader
        title="Customers"
        actions={rows && rows.length > 0 ? <Button variant="secondary" onClick={() => setComposer(rows)}><Mail aria-hidden /> Email {extra || view !== "all" ? "this view" : "customers"}</Button> : undefined}
      />
      {/* Views and filters only once there's someone to sort */}
      {!!data?.length && (
        <>
      <StatusTabs label="Customer views" value={extra ? "" : view} onChange={(v) => { setExtra(undefined); setView(v); }} tabs={views.map((v) => ({ value: v.id, label: v.name }))} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={extra?.kind === "product" ? extra.value : ANY} onValueChange={(v) => setExtra(v === ANY ? undefined : { kind: "product", value: v })}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Bought a product"><SelectValue placeholder="Bought…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Bought anything</SelectItem>
            {(products.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>Bought {p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {tags.length > 0 && (
          <Select value={extra?.kind === "tag" ? extra.value : ANY} onValueChange={(v) => setExtra(v === ANY ? undefined : { kind: "tag", value: v })}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Tag"><SelectValue placeholder="Tag…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any tag</SelectItem>
              {tags.map((t) => <SelectItem key={t} value={t}>Tagged {t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {extra && <Button variant="secondary" onClick={() => void saveView()}><Save aria-hidden /> Save this view</Button>}
        {!extra && active?.saved && (
          <Button
            variant="ghost"
            onClick={async () => {
              await deleteSegment(active.saved!.id);
              setView("all");
              saved.reload();
            }}
          >
            <Trash2 aria-hidden /> Delete view
          </Button>
        )}
      </div>
        </>
      )}
      <DataTable
        key={extra ? `${extra.kind}:${extra.value}` : view}
        label="Customers"
        columns={columns}
        data={rows}
        loading={(loading && !data) || (!!productId && orders.loading)}
        error={error}
        onRetry={reload}
        searchPlaceholder="Search name, email or tag"
        noResults="Nobody fits this view."
        filters={countries.length > 1 ? [{ columnId: "countryCode", label: "Countries", options: countries }] : []}
        rowId={(c) => c.id}
        selectable
        bulkActions={(list, clear) => (
          <>
            <Button size="sm" onClick={() => setComposer(list)}><Mail aria-hidden /> Email {list.length}</Button>
            <TagButton
              onTag={async (t) => {
                await tagCustomers(list, t);
                toast.success(`Tagged ${list.length} ${t}`);
                clear();
                reload();
              }}
            />
          </>
        )}
        defaultHidden={["first"]}
        dateFilter={{ get: (c) => c.lastOrderAt, label: "Last order" }}
        summary={(r) => {
          const cur = r[0]?.totalSpent.currency ?? "INR";
          return [
            { label: "Customers", value: r.length.toLocaleString("en-IN") },
            { label: "Get your emails", value: r.filter((c) => c.subscribed).length },
            { label: "Total spent", value: <MoneyText value={money(r.reduce((t, c) => t + c.totalSpent.amount, 0), cur)} /> },
          ];
        }}
        csv={{
          filename: "powerproof-customers",
          columns: [
            { header: "Name", value: (c) => c.name },
            { header: "Email", value: (c) => c.email },
            { header: "Country", value: (c) => c.country },
            { header: "Orders", value: (c) => c.ordersCount },
            { header: "Spent", value: (c) => csvAmount(c.totalSpent) },
            { header: "Currency", value: (c) => c.totalSpent.currency },
            { header: "Tags", value: (c) => c.tags.join("; ") },
            { header: "Gets your emails", value: (c) => (c.subscribed ? "yes" : "no") },
            { header: "First order", value: (c) => c.firstOrderAt },
            { header: "Last order", value: (c) => c.lastOrderAt },
          ],
        }}
        rowHref={(c) => `/sales/customers/${c.id}`}
        mobileCard={(c) => (
          <Link href={`/sales/customers/${c.id}`} className="flex items-center gap-3 rounded-card border bg-surface p-4">
            <Avatar className="size-10"><AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">{initials(c.name)}</AvatarFallback></Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.name}</span>
              <span className="block truncate text-sm text-muted-foreground">{c.ordersCount} order{c.ordersCount === 1 ? "" : "s"}{c.tags.length ? ` · ${c.tags.join(", ")}` : ""}</span>
            </span>
            <MoneyText value={c.totalSpent} className="font-semibold" />
          </Link>
        )}
        empty={<EmptyState nextStep icon={Users} title="No customers yet." body="People who buy from you land here, with everything they've bought." action={<Button asChild><Link href="/dashboard">Get your store link</Link></Button>} />}
      />
      <EmailComposer key={composer?.map((c) => c.id).join() ?? "closed"} customers={composer ?? []} open={!!composer} onOpenChange={(o) => !o && setComposer(null)} />
    </>
  );
}

/** Add a tag to the ticked customers */
function TagButton({ onTag }: { onTag: (tag: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary"><Tag aria-hidden /> Tag</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!tag.trim()) return;
            await onTag(tag.trim());
            setTag("");
            setOpen(false);
          }}
        >
          <Input size="sm" autoFocus aria-label="Tag" placeholder="VIP, wholesale…" maxLength={30} value={tag} onChange={(e) => setTag(e.target.value)} />
          <Button type="submit" size="sm" disabled={!tag.trim()}>Add</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
