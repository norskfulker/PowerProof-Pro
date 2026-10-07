"use client";

import { useMemo, useState } from "react";
import { MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReviewItem } from "@/components/pp/review-item";
import { ReviewSummary } from "@/components/pp/review-summary";
import { reportReview } from "@/lib/api";
import { ratingSummary } from "@/lib/pricing";
import type { Review, ReviewSort } from "@/lib/types";

const SORTS: { id: ReviewSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "highest", label: "Highest rated" },
  { id: "lowest", label: "Lowest rated" },
];

/** Summary, star filter, sort and the list. Pinned reviews lead; imported testimonials are labelled. */
const PAGE = 10;

export function ProductReviews({ reviews, creatorName }: { reviews: Review[]; creatorName: string }) {
  const [star, setStar] = useState<number>();
  const [sort, setSort] = useState<ReviewSort>("newest");
  /** Reviews are shown 10 at a time; a product can have thousands */
  const [shown, setShown] = useState(PAGE);
  const summary = useMemo(() => ratingSummary(reviews), [reviews]);

  const list = useMemo(() => {
    const filtered = reviews.filter((r) => !star || r.rating === star);
    const s = [...filtered];
    if (sort === "newest") s.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "highest") s.sort((a, b) => b.rating - a.rating);
    if (sort === "lowest") s.sort((a, b) => a.rating - b.rating);
    return s.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [reviews, star, sort]);

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
        <MessageSquareHeart className="size-6 text-primary" aria-hidden />
        <p className="font-display text-lg">No reviews yet. Be the first.</p>
        <p className="max-w-sm text-sm text-muted-foreground">Buyers get a private link to review after their purchase. No account needed.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ReviewSummary summary={summary} active={star} onFilter={(s) => { setStar(s); setShown(PAGE); }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {star ? `${list.length.toLocaleString("en-IN")} ${star}-star review${list.length === 1 ? "" : "s"}` : `${list.length.toLocaleString("en-IN")} review${list.length === 1 ? "" : "s"}`}
          {star && (
            <button type="button" onClick={() => { setStar(undefined); setShown(PAGE); }} className="ml-2 min-h-11 font-medium text-foreground underline underline-offset-4">Show all</button>
          )}
        </p>
        <Select value={sort} onValueChange={(v) => { setSort(v as ReviewSort); setShown(PAGE); }}>
          <SelectTrigger className="w-48" aria-label="Sort reviews"><SelectValue /></SelectTrigger>
          <SelectContent>{SORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="rounded-card border bg-surface px-5">
        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No {star}-star reviews.</p>
        ) : (
          list.slice(0, shown).map((r) => <ReviewItem key={r.id} review={r} creatorName={creatorName} onReport={reportReview} />)
        )}
      </div>
      {list.length > shown && (
        <div className="flex flex-col items-center gap-1">
          <Button type="button" variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
            Show more reviews
          </Button>
          <p className="text-xs text-muted-foreground">
            Showing {shown.toLocaleString("en-IN")} of {list.length.toLocaleString("en-IN")}
          </p>
        </div>
      )}
    </div>
  );
}
