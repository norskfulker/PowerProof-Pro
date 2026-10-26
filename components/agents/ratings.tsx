"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { getMyRating, getRatings, rateAgent } from "@/lib/api/agents";
import type { RatingSummary } from "@/lib/types/agents";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Stars from stores that ran the agent: the average and count, the latest comments, and rating it yourself */

export function Stars({ value, className, size = "size-4" }: { value: number; className?: string; size?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} out of 5`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="relative inline-block" aria-hidden>
          <Star className={cn(size, "text-border")} fill="currentColor" strokeWidth={0} />
          <span className="absolute inset-0 overflow-hidden text-[#f5a524]" style={{ width: `${Math.max(0, Math.min(1, value - n + 1)) * 100}%` }}>
            <Star className={size} fill="currentColor" strokeWidth={0} />
          </span>
        </span>
      ))}
    </span>
  );
}

/** "★★★★☆ 4.3 · 12 ratings", or "No ratings yet" */
export function RatingLine({ summary, className }: { summary?: RatingSummary; className?: string }) {
  if (!summary) return <span className={cn("text-sm text-muted-foreground", className)}>…</span>;
  if (!summary.count || summary.average === null) return <span className={cn("text-sm text-muted-foreground", className)}>No ratings yet</span>;
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <Stars value={summary.average} />
      <span className="font-semibold tabular">{summary.average.toFixed(1)}</span>
      <span className="text-muted-foreground">
        · {summary.count} {summary.count === 1 ? "rating" : "ratings"}
      </span>
    </span>
  );
}

export function RatingsSection({ agentId, agentName, summary, onRated, inApp }: { agentId: string; agentName: string; summary?: RatingSummary; onRated: () => void; inApp: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2 rounded-card border bg-surface p-5">
        <span className="font-display text-5xl font-bold tabular">{summary?.average != null && summary.count ? summary.average.toFixed(1) : "—"}</span>
        {summary?.average != null && summary.count > 0 && <Stars value={summary.average} size="size-5" />}
        <span className="text-sm text-muted-foreground">{summary?.count ? `${summary.count} ${summary.count === 1 ? "store" : "stores"} rated it` : "No ratings yet"}</span>
        {inApp && <RateIt agentId={agentId} agentName={agentName} onRated={onRated} />}
      </div>
      {summary?.recent.some((r) => r.comment) ? (
        <ul className="flex flex-col gap-3">
          {summary.recent
            .filter((r) => r.comment)
            .slice(0, 6)
            .map((r, i) => (
              <li key={i} className="flex flex-col gap-1.5 rounded-card border bg-surface p-4">
                <span className="flex items-center justify-between gap-2">
                  <Stars value={r.stars} />
                  <span className="text-xs text-muted-foreground">{timeAgo(r.at)}</span>
                </span>
                <p className="text-sm">{r.comment}</p>
                <span className="text-xs text-muted-foreground">A store using {agentName}</span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="self-center text-sm text-muted-foreground">Stores that run {agentName} rate it here.</p>
      )}
    </div>
  );
}

/** Rating it: only for a store that has run it; one rating per store, changeable */
function RateIt({ agentId, agentName, onRated }: { agentId: string; agentName: string; onRated: () => void }) {
  const mine = useApi(() => getMyRating(agentId), [agentId]);
  const [stars, setStars] = useState<number | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!mine.data?.canRate) return null;
  const s = stars ?? mine.data.stars ?? 0;
  const c = comment ?? mine.data.comment;
  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3">
      <span className="text-sm font-semibold">{mine.data.stars ? "Your rating" : `Rate ${agentName}`}</span>
      <div role="radiogroup" aria-label="Stars" className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={s === n} aria-label={`${n} ${n === 1 ? "star" : "stars"}`} onClick={() => setStars(n)} className="grid size-9 place-items-center rounded-control hover:bg-muted pointer-coarse:size-11">
            <Star className={cn("size-5", n <= s ? "text-[#f5a524]" : "text-border")} fill="currentColor" strokeWidth={0} aria-hidden />
          </button>
        ))}
      </div>
      <Textarea rows={2} maxLength={600} placeholder="What worked, what didn't (optional)" value={c} onChange={(e) => setComment(e.target.value)} aria-label="Comment" />
      <Button
        size="sm"
        disabled={!s || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await rateAgent(agentId, s, c.trim());
            toast.success("Thanks. Your rating is in.");
            mine.reload();
            onRated();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {mine.data.stars ? "Update rating" : "Rate it"}
      </Button>
    </div>
  );
}

/** The agent's ratings, loaded once for the page */
export const useRatings = (agentId: string) => useApi(() => getRatings(agentId), [agentId]);
