"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/pp/segmented";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { PageHeader } from "@/components/pp/page-header";
import { ReviewSummary } from "@/components/pp/review-summary";
import { InboxReviewCard } from "@/components/store-admin/review-card";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { getReviewsInbox } from "@/lib/api";
import { ratingSummary } from "@/lib/pricing";
import type { InboxReview } from "@/lib/api";

const FILTERS = [
  ["all", "All"],
  ["reply", "Needs a reply"],
  ["pinned", "Pinned"],
  ["hidden", "Hidden"],
  ["reported", "Reported"],
] as const;

/** Shown 20 at a time; a store can have thousands of reviews */
const PAGE = 20;

/**
 * The reviews inbox: reply, pin and hide. Lives in the store editor beside the page that shows
 * the reviews (`compact`), so a hidden review leaves the preview straight away (`onChange`).
 */
export function ReviewsInbox({ compact, onChange }: { compact?: boolean; onChange?: (r: InboxReview) => void }) {
  const { data, loading, error, reload, setData } = useApi(getReviewsInbox, [], { live: true });
  const store = useCurrentStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => (data ?? []).filter((r) =>
    filter === "all" ? true : filter === "reply" ? !r.reply : filter === "pinned" ? r.pinned : filter === "hidden" ? r.hidden : filter === "reported" ? r.reported : false
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data, filter]);

  return (
    <>
      {compact ? (
        <p className="mb-3 text-sm text-muted-foreground">Only verified buyers can review. Reply, pin up to 3 and hide spam; stars and words stay as written.</p>
      ) : (
        <PageHeader
          title="Reviews"
          description="Only verified buyers can review. You can reply, pin up to 3 and hide spam. You can't change stars or words; that's what makes them worth reading."
          actions={
            <Button asChild variant="secondary"><Link href="/dashboard">Get your store link</Link></Button>
          }
        />
      )}
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-96 rounded-card" /> : data && data.length === 0 ? (
        <EmptyState compact={compact} icon={MessageSquareHeart} title="No reviews yet." body="Reviews from verified buyers show up here. Share your store link to get your first sale." action={<Button asChild><Link href="/dashboard">Get your store link</Link></Button>} />
      ) : data && (
        <div className="flex flex-col gap-4">
          {!compact && <ReviewSummary summary={ratingSummary(data)} />}
          <Segmented label="Filter reviews"  value={filter} onChange={(f) => { setFilter(f); setShown(PAGE); }} options={FILTERS.map(([value, label]) => ({ value, label }))} />
          {list.length === 0 ? <p className="rounded-card border bg-surface py-10 text-center text-sm text-muted-foreground">Nothing here.</p> : (
            <ul className="flex flex-col gap-3">
              {list.slice(0, shown).map((r) => <InboxReviewCard key={r.id} review={r} creatorName={store.data?.ownerName.split(" ")[0] ?? "You"} onChange={(n) => { setData(data.map((x) => (x.id === n.id ? n : x))); onChange?.(n); }} />)}
            </ul>
          )}
          {list.length > shown && (
            <div className="flex flex-col items-center gap-1">
              <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>Show more</Button>
              <p className="text-xs text-muted-foreground">Showing {shown.toLocaleString("en-IN")} of {list.length.toLocaleString("en-IN")}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
