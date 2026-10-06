"use client";

import { use } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { PageHeader } from "@/components/pp/page-header";
import { StatCard } from "@/components/pp/stat-card";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getCustomer } from "@/lib/api";
import { countryShort, formatDate, initials } from "@/lib/format";
import { CURRENCIES } from "@/lib/money";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, reload } = useApi(() => getCustomer(id), [id], { live: true });

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
        <Skeleton className="h-80 rounded-card" />
      </div>
    );
  }

  const { customer: c, orders } = data;
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
        description={`${c.email} · ${countryShort(c.countryCode)} · pays in ${CURRENCIES[c.currency].name}s`}
        actions={
          <Button asChild variant="secondary">
            <a href={`mailto:${c.email}`}><Mail aria-hidden /> Email</a>
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total spent" value={<MoneyText value={c.totalSpent} />} emphasis />
        <StatCard label="Orders" value={c.ordersCount} />
        <StatCard label="Customer since" value={formatDate(c.firstOrderAt)} />
      </div>
      <section aria-labelledby="hist-h" className="overflow-hidden rounded-card border bg-surface">
        <h2 id="hist-h" className="border-b px-5 py-4 font-sans text-base font-semibold tracking-normal">Purchase history</h2>
        {orders.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No completed purchases.</p>
        ) : (
          <ul className="divide-y">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/sales/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-muted">
                  <span className="font-mono text-xs text-muted-foreground">{o.number}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{o.productTitle}</span>
                  <span className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</span>
                  <StatusPill status={o.status} />
                  <MoneyText value={o.buyerTotal} mono className="w-24 text-right" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
