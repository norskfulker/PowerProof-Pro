"use client";

import { useState } from "react";
import { Eye, EyeOff, Flag, Loader2, Pin, PinOff, Reply } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReviewItem } from "@/components/pp/review-item";
import { replyToReview, reportReview, setReviewFlag, type InboxReview } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Creator moderation: reply once, pin, hide spam, report. Stars and text can't be edited. */
export function InboxReviewCard({ review, creatorName, onChange }: { review: InboxReview; creatorName: string; onChange: (r: InboxReview) => void }) {
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState(review.reply?.body ?? "");
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();

  async function act(key: string, fn: () => Promise<Partial<InboxReview> | void>, done: string) {
    setPending(key);
    try {
      const out = await fn();
      if (out) onChange({ ...review, ...out });
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setPending(undefined);
    }
  }

  return (
    <li className={cn("rounded-card border bg-surface px-5", review.hidden && "opacity-70")}>
      {review.hidden && <p className="mt-4 text-xs font-semibold text-muted-foreground">Hidden from your store</p>}
      {review.reported && <p className="mt-4 text-xs font-semibold text-warning-ink">Reported to PowerProof for review</p>}
      <ReviewItem review={review} creatorName={creatorName} productTitle={review.productTitle} className="border-b-0" />
      {replying && (
        <form
          noValidate
          className="mb-4 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (body.trim().length < 2) return setError("Write a reply first.");
            await act("reply", async () => replyToReview(review.id, body), review.reply ? "Reply updated" : "Reply posted");
            setReplying(false);
          }}
        >
          <Label htmlFor={`r-${review.id}`}>Your reply (shown under the review, labelled Creator)</Label>
          <Textarea id={`r-${review.id}`} rows={3} value={body} onChange={(e) => { setBody(e.target.value); setError(undefined); }} aria-invalid={!!error || undefined} />
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending === "reply"}>{pending === "reply" && <Loader2 className="animate-spin" aria-hidden />} Post reply</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
          </div>
        </form>
      )}
      <div className="flex flex-wrap gap-1 border-t py-2">
        {!replying && (
          <Button variant="ghost" size="sm" onClick={() => setReplying(true)}><Reply aria-hidden /> {review.reply ? "Edit reply" : "Reply"}</Button>
        )}
        <Button variant="ghost" size="sm" disabled={!!pending} onClick={() => act("pin", () => setReviewFlag(review.id, "pinned", !review.pinned), review.pinned ? "Unpinned" : "Pinned to the top")}>
          {review.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />} {review.pinned ? "Unpin" : "Pin"}
        </Button>
        <Button variant="ghost" size="sm" disabled={!!pending} onClick={() => act("hide", () => setReviewFlag(review.id, "hidden", !review.hidden), review.hidden ? "Visible again" : "Hidden from your store")}>
          {review.hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />} {review.hidden ? "Unhide" : "Hide as spam"}
        </Button>
        {!review.reported && (
          <Button variant="ghost" size="sm" disabled={!!pending} onClick={() => act("report", async () => { await reportReview(review.id); return { reported: true }; }, "Reported to PowerProof")}>
            <Flag aria-hidden /> Report
          </Button>
        )}
      </div>
    </li>
  );
}
