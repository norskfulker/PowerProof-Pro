"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package, Receipt, Search, Store, Users } from "lucide-react";
import { EmptyState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { Input } from "@/components/ui/input";
import { adminSearch, type AdminHit } from "@/lib/api";

const KINDS: Record<AdminHit["kind"], { title: string; icon: typeof Store; href: (h: AdminHit) => string | null }> = {
  creator: { title: "Creators", icon: Users, href: (h) => `/admin/creators?q=${encodeURIComponent(h.label)}` },
  store: { title: "Stores", icon: Store, href: (h) => `/admin/stores?q=${encodeURIComponent(h.label)}` },
  order: { title: "Orders", icon: Receipt, href: (h) => `/admin/orders?q=${encodeURIComponent(h.label)}` },
  // Products have no console page of their own: the result still shows which store sells it
  product: { title: "Products", icon: Package, href: () => null },
};

export default function Page() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AdminHit[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      setBusy(true);
      adminSearch(term).then(
        (r) => alive && (setHits(r), setError(undefined), setBusy(false)),
        (e: Error) => alive && (setError(e.message), setBusy(false))
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const ready = q.trim().length >= 2;
  const groups = (Object.keys(KINDS) as AdminHit["kind"][]).map((k) => ({ k, rows: (hits ?? []).filter((h) => h.kind === k) })).filter((g) => g.rows.length);

  return (
    <>
      <title>Search · PowerProof admin</title>
      <PageHeader title="Search" description="Find any order, buyer, creator or store. Buyer emails stay partly hidden." />
      <div className="relative mb-6 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" autoFocus aria-label="Search the platform" placeholder="Order number, buyer email, store or creator" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        {busy && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">{error}</p>
      ) : !ready ? (
        <EmptyState icon={Search} title="Type at least two letters." body="Results appear as you type." compact />
      ) : hits && !groups.length && !busy ? (
        <EmptyState icon={Search} title="Nothing found." body="Check the spelling, or try part of an order number or email." compact />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ k, rows }) => (
            <section key={k} aria-label={KINDS[k].title}>
              <h2 className="mb-2 flex items-center gap-2 font-display text-lg">
                {(() => {
                  const Icon = KINDS[k].icon;
                  return <Icon className="size-4 text-muted-foreground" aria-hidden />;
                })()}
                {KINDS[k].title}
              </h2>
              <ul className="divide-y rounded-card border bg-surface">
                {rows.map((h) => {
                  const href = KINDS[k].href(h);
                  const body = (
                    <>
                      <span className="font-medium">{h.label}</span>
                      <span className="text-sm text-muted-foreground">{h.sublabel}</span>
                    </>
                  );
                  return (
                    <li key={`${h.kind}-${h.id}`}>
                      {href ? (
                        <Link href={href} className="flex min-h-12 flex-col justify-center px-4 py-2 hover:bg-surface-sunken">{body}</Link>
                      ) : (
                        <div className="flex min-h-12 flex-col justify-center px-4 py-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
