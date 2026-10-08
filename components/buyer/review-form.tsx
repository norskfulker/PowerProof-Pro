"use client";

import { useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Rate something you bought. The order link proves you did; the review shows on the product with a Verified buyer mark. */
export function ReviewForm({ token, productId, title, done }: { token: string; productId: string; title: string; done: boolean }) {
  const [rating, setRating] = useState(0);
  const [heading, setHeading] = useState("");
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "done">(done ? "done" : "idle");
  const [error, setError] = useState<string>();

  if (state === "done")
    return <li className="flex items-center gap-2 py-3 text-sm"><Check className="size-4 text-success" aria-hidden /> Thanks for reviewing <strong className="font-medium">{title}</strong>.</li>;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Pick a star rating first.");
    setState("pending");
    setError(undefined);
    try {
      await submitReview(token, productId, { rating, title: heading, body: text });
      return setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't save your review.");
    }
    setState("idle");
  }

  return (
    <li className="py-4">
      <form noValidate onSubmit={send} className="flex flex-col gap-3">
        <p className="text-sm font-medium">{title}</p>
        <div role="radiogroup" aria-label={`Rating for ${title}`} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)} className="grid size-10 place-items-center rounded-control hover:bg-muted pointer-coarse:size-11">
              <Star className={cn("size-6", n <= rating ? "fill-accent text-accent" : "text-muted-foreground")} aria-hidden />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <>
            <Input aria-label="Review title (optional)" placeholder="A headline (optional)" maxLength={120} value={heading} onChange={(e) => setHeading(e.target.value)} />
            <Textarea aria-label="Your review (optional)" placeholder="What did you think? (optional)" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          </>
        )}
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" size="sm" className="w-fit" disabled={state === "pending"}>{state === "pending" && <Loader2 className="animate-spin" aria-hidden />} Post review</Button>
      </form>
    </li>
  );
}
