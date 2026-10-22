"use client";

import { useState } from "react";
import { BadgeCheck, Check, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitOpenReview } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Anyone can review a product, before or after buying. With the email they bought with, the review
 * is marked "Verified buyer"; otherwise it says "Not verified yet" until that email buys it.
 */
export function WriteReview({ slug, productId, onDone }: { slug: string; productId: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "verified" | "unverified">("idle");
  const [error, setError] = useState<string>();

  if (state === "verified" || state === "unverified") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-card border bg-surface px-4 py-3 text-sm">
        {state === "verified" ? <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />}
        {state === "verified" ? "Thanks! Your review is up, marked Verified buyer." : "Thanks! Your review is up. It shows as verified once you buy with this email."}
      </p>
    );
  }
  if (!open) {
    return (
      <Button type="button" variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        <Star aria-hidden /> Write a review
      </Button>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Pick a star rating first.");
    if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Add your name and a valid email.");
    setState("pending");
    setError(undefined);
    try {
      const verified = await submitOpenReview(slug, productId, { name, email, rating, title, body });
      setState(verified ? "verified" : "unverified");
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save your review.");
      setState("idle");
    }
  }

  return (
    <form noValidate onSubmit={send} className="flex flex-col gap-3 rounded-card border bg-surface p-4">
      <div role="radiogroup" aria-label="Your rating" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)} className="grid size-10 place-items-center rounded-control hover:bg-muted pointer-coarse:size-11">
            <Star className={cn("size-6", n <= rating ? "fill-accent text-accent" : "text-muted-foreground")} aria-hidden />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wr-name">Name</Label>
          <Input id="wr-name" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wr-email">Email</Label>
          <Input id="wr-email" type="email" autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <Input aria-label="Review title (optional)" placeholder="A headline (optional)" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea aria-label="Your review (optional)" placeholder="What did you think? (optional)" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="text-xs text-muted-foreground">Your email is never shown. Use the one you bought with and your review is marked Verified buyer.</p>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={state === "pending"}>{state === "pending" && <Loader2 className="animate-spin" aria-hidden />} Post review</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
