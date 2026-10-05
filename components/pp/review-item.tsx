"use client";

import { useState } from "react";
import { BadgeCheck, Flag, Pin, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductImageView } from "./product-cover";
import { Stars } from "./stars";

const VOTED_KEY = "pp:helpful";

function votedSet(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(VOTED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

/** One review. Helpful votes are limited to one per device; reports go to the founder's flags queue. */
export function ReviewItem({
  review,
  creatorName,
  productTitle,
  onHelpful,
  onReport,
  className,
}: {
  review: Review;
  creatorName: string;
  productTitle?: string;
  onHelpful?: (id: string) => Promise<number>;
  onReport?: (id: string) => Promise<void>;
  className?: string;
}) {
  const [helpful, setHelpful] = useState(review.helpful);
  const [voted, setVoted] = useState(() => (typeof window === "undefined" ? false : votedSet().has(review.id)));
  const [reported, setReported] = useState(false);

  return (
    <article className={cn("flex flex-col gap-3 border-b py-5 last:border-b-0", className)} aria-label={`Review by ${review.author}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        <span className="font-semibold">{review.title}</span>
        {review.pinned && (
          <span className="inline-flex items-center gap-1 text-xs text-accent-ink"><Pin className="size-3" aria-hidden /> Pinned</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{review.author}</span>
        {review.imported ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">Imported</span>
        ) : review.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
            <BadgeCheck className="size-3.5" aria-hidden /> Verified buyer
          </span>
        ) : null}
        <span>· {formatDate(review.createdAt)}</span>
        {productTitle && <span>· {productTitle}</span>}
      </div>
      <p className="leading-relaxed whitespace-pre-line">{review.body}</p>
      {review.photos.length > 0 && (
        <ul className="flex gap-2" aria-label="Photos from the buyer">
          {review.photos.map((ph) => (
            <li key={ph.id} className="w-24"><ProductImageView image={ph} size="xs" /></li>
          ))}
        </ul>
      )}
      {review.reply && (
        <div className="ml-4 rounded-control border-l-2 border-accent bg-surface-sunken px-4 py-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            {creatorName} <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">Creator</span>
          </p>
          <p className="text-foreground/85">{review.reply.body}</p>
        </div>
      )}
      {(onHelpful || onReport) && (
        <div className="flex items-center gap-2">
          {onHelpful && (
            <Button
              variant="ghost"
              size="sm"
              disabled={voted}
              aria-pressed={voted}
              onClick={async () => {
                setVoted(true);
                setHelpful((h) => h + 1);
                try {
                  window.localStorage.setItem(VOTED_KEY, JSON.stringify([...votedSet(), review.id]));
                } catch {
                  /* private mode */
                }
                await onHelpful(review.id);
              }}
            >
              <ThumbsUp aria-hidden /> Helpful ({helpful})
            </Button>
          )}
          {onReport && (
            <Button
              variant="ghost"
              size="sm"
              disabled={reported}
              className="text-muted-foreground"
              onClick={async () => {
                setReported(true);
                await onReport(review.id);
                toast.success("Reported", { description: "Thanks. PowerProof will take a look." });
              }}
            >
              <Flag aria-hidden /> {reported ? "Reported" : "Report"}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
