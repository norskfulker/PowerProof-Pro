"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { MoneyText } from "@/components/pp/money-text";
import { StatusPill } from "@/components/pp/status-pill";
import { useApi } from "@/hooks/use-api";
import { getRecentOrders } from "@/lib/api";
import { countryShort, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Orders as they land. Refreshes on any data change, including a buyer paying in another tab. */
export function LiveFeed() {
  const { data, loading, error, reload } = useApi(() => getRecentOrders(7), [], { live: true });
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [, setNow] = useState(0);

  useEffect(() => {
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.map((o) => o.id));
      return;
    }
    const arrivals = data.filter((o) => !seen.current!.has(o.id)).map((o) => o.id);
    arrivals.forEach((id) => seen.current!.add(id));
    if (!arrivals.length) return;
    const t1 = setTimeout(() => setFresh(new Set(arrivals)), 0);
    const t2 = setTimeout(() => setFresh(new Set()), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [data]);

  // Re-render every 30s so "2 min ago" stays honest
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <section aria-labelledby="feed-h" className="flex flex-col rounded-card border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 id="feed-h" className="flex items-center gap-2 font-display text-lg">
          Live orders
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
        </h2>
        <Link href="/orders" className="inline-flex pointer-coarse:min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          All orders
        </Link>
      </header>
      {error ? (
        <ErrorState className="m-4" message={error} onRetry={reload} />
      ) : loading && !data ? (
        <ul className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3.5">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : data && data.length === 0 ? (
        <EmptyState icon={Radio} compact className="m-4 border-0" title="Nothing sold yet." body="Your first sale will show up here, live." />
      ) : (
        <ul className="divide-y" aria-live="polite" aria-relevant="additions">
          {data?.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5 transition-colors duration-700 hover:bg-muted",
                  fresh.has(o.id) && "bg-accent-soft"
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-mono text-[0.6875rem] font-semibold text-primary">
                  {o.countryCode}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{o.productTitle}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {o.buyerName} · {countryShort(o.countryCode)} · {timeAgo(o.createdAt)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <MoneyText value={o.buyerTotal} className="text-sm font-semibold" />
                  {o.status !== "paid" && <StatusPill status={o.status} />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
