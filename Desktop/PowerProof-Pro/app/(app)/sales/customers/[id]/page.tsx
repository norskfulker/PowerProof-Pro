"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, MailCheck, MailX, X } from "lucide-react";
import { toast } from "sonner";
import { EmailComposer } from "@/components/customers/email-composer";
import { ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatusPill } from "@/components/pp/status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { getCustomer, saveCustomerProfile } from "@/lib/api";
import { formatDate, initials, timeAgo } from "@/lib/format";
import { money } from "@/lib/money";
import type { Customer, Order } from "@/lib/types";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, reload, setData } = useApi(() => getCustomer(id), [id], { live: true });
  const [composing, setComposing] = useState(false);

  if (error) {
    return (
      <>
        <PageHeader title="Customer" back={{ href: "/sales/customers", label: "Customers" }} />
        <ErrorState title={error.includes("not found") ? "We can't find that customer." : undefined} message={error} onRetry={reload} />
      </>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    );
  }

  const { customer: c, orders } = data;
  const update = (patch: Partial<Customer>) => setData({ ...data, customer: { ...c, ...patch } });
  return (
    <>
      <PageHeader
        back={{ href: "/sales/customers", label: "Customers" }}
        title={
          <span className="flex items-center gap-4">
            <Avatar className="size-12"><AvatarFallback className="bg-accent-soft font-semibold text-accent-ink">{initials(c.name)}</AvatarFallback></Avatar>
            {c.name}
          </span>
        }
        actions={<Button variant="secondary" disabled={c.unsubscribed} onClick={() => setComposing(true)}><Mail aria-hidden /> Email</Button>}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Numbers customer={c} orders={orders} />
          <Favourites orders={orders} />
          <section aria-labelledby="hist-h" className="overflow-hidden rounded-card border bg-surface">
            <h2 id="hist-h" className="border-b px-5 py-4 font-sans text-base font-semibold tracking-normal">Orders</h2>
            {orders.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No completed purchases.</p>
            ) : (
              <ul className="divide-y">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/sales/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-muted">
                      <span className="font-mono text-xs text-muted-foreground">{o.number}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{o.productTitle}{o.items.length > 1 ? ` +${o.items.length - 1}` : ""}</span>
                      <span className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</span>
                      <StatusPill status={o.status} />
                      <MoneyText value={o.buyerTotal} mono className="w-24 text-right" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          <section className="flex flex-col gap-2 rounded-card border bg-surface p-5" aria-label="Contact">
            <p className="text-sm font-medium [overflow-wrap:anywhere]">{c.email}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {c.unsubscribed ? <><MailX className="size-4" aria-hidden /> Unsubscribed from your emails</> : c.subscribed ? <><MailCheck className="size-4 text-success" aria-hidden /> Gets your emails</> : <><Mail className="size-4" aria-hidden /> Didn&apos;t ask for your emails</>}
            </p>
          </section>
          <TagsCard customer={c} onSaved={(tags) => update({ tags })} />
          <NoteCard customer={c} onSaved={(note) => update({ note })} />
        </aside>
      </div>
      <EmailComposer key={composing ? "open" : "closed"} customers={[c]} open={composing} onOpenChange={setComposing} />
    </>
  );
}

/** Lifetime value and how they buy */
function Numbers({ customer: c, orders }: { customer: Customer; orders: Order[] }) {
  const refunds = orders.filter((o) => o.status === "refunded" || o.refunded).length;
  const stat = (label: string, value: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-0.5 bg-surface px-4 py-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-display text-xl font-bold tabular">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border bg-border sm:grid-cols-4">
      {stat("Lifetime value", <MoneyText value={c.totalSpent} />)}
      {stat("Orders", c.ordersCount, refunds ? `${refunds} refunded` : undefined)}
      {stat("Average order", <MoneyText value={money(Math.round(c.totalSpent.amount / Math.max(1, c.ordersCount)), c.totalSpent.currency)} />)}
      {stat("Last order", timeAgo(c.lastOrderAt), `Customer since ${formatDate(c.firstOrderAt)}`)}
    </dl>
  );
}

/** What they buy most, across their paid orders */
function Favourites({ orders }: { orders: Order[] }) {
  const items = useMemo(() => {
    const by = new Map<string, { title: string; productId: string; units: number; spent: number; currency: Order["total"]["currency"] }>();
    for (const o of orders.filter((x) => x.status === "paid")) {
      for (const i of o.items.filter((x) => !x.gift)) {
        const k = i.productId || i.title;
        const cur = by.get(k) ?? { title: i.title, productId: i.productId, units: 0, spent: 0, currency: i.price.currency };
        by.set(k, { ...cur, units: cur.units + (i.quantity ?? 1), spent: cur.spent + i.price.amount });
      }
    }
    return [...by.values()].sort((a, b) => b.spent - a.spent).slice(0, 5);
  }, [orders]);
  if (items.length < 2) return null;
  return (
    <section aria-labelledby="fav-h" className="rounded-card border bg-surface p-5">
      <h2 id="fav-h" className="mb-3 font-sans text-base font-semibold tracking-normal">What they buy</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((i) => (
          <li key={i.productId || i.title} className="flex items-center justify-between gap-3">
            {i.productId ? <Link href={`/catalog/products/${i.productId}`} className="min-w-0 truncate font-medium hover:underline">{i.title}</Link> : <span className="min-w-0 truncate font-medium">{i.title}</span>}
            <span className="shrink-0 text-muted-foreground">{i.units} · <MoneyText value={money(i.spent, i.currency)} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TagsCard({ customer: c, onSaved }: { customer: Customer; onSaved: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const save = async (tags: string[]) => {
    try {
      await saveCustomerProfile(c.email, { tags });
      onSaved(tags);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't save.");
    }
  };
  return (
    <section className="flex flex-col gap-3 rounded-card border bg-surface p-5" aria-labelledby="tags-h">
      <h2 id="tags-h" className="font-sans text-base font-semibold tracking-normal">Tags</h2>
      {c.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-2.5 text-sm font-medium text-accent-ink">
              {t}
              <button type="button" className="grid size-6 place-items-center rounded-full hover:bg-background" aria-label={`Remove ${t}`} onClick={() => void save(c.tags.filter((x) => x !== t))}>
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t || c.tags.includes(t)) return setDraft("");
          void save([...c.tags, t]);
          setDraft("");
        }}
      >
        <Input size="sm" aria-label="Add a tag" placeholder="VIP, wholesale…" maxLength={30} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" size="sm" variant="secondary" disabled={!draft.trim()}>Add</Button>
      </form>
    </section>
  );
}

function NoteCard({ customer: c, onSaved }: { customer: Customer; onSaved: (note: string) => void }) {
  const [note, setNote] = useState(c.note ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const save = async () => {
    if (note === (c.note ?? "")) return;
    setState("saving");
    try {
      await saveCustomerProfile(c.email, { note });
      onSaved(note);
      setState("saved");
    } catch (e) {
      setState("idle");
      toast.error(e instanceof Error ? e.message : "That didn't save.");
    }
  };
  return (
    <section className="flex flex-col gap-2 rounded-card border bg-surface p-5" aria-labelledby="note-h">
      <div className="flex items-center justify-between">
        <h2 id="note-h" className="font-sans text-base font-semibold tracking-normal">Note</h2>
        <span className="text-xs text-muted-foreground" role="status">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Only your team sees this"}</span>
      </div>
      <Textarea aria-label="Note about this customer" placeholder="Prefers WhatsApp, ordered for their studio…" maxLength={4000} value={note} onChange={(e) => { setNote(e.target.value); setState("idle"); }} onBlur={() => void save()} />
    </section>
  );
}
