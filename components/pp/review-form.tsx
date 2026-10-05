"use client";

import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkMedia, MEDIA_LIMITS, putAsset } from "@/lib/media/store";
import type { ProductImage, Review } from "@/lib/types";
import { ProductImageView } from "./product-cover";
import { StarInput } from "./stars";

export interface ReviewDraft {
  rating: Review["rating"];
  title: string;
  body: string;
  photos: ProductImage[];
}

/** Verified-buyer review form: stars, title, text and up to 3 photos. */
export function ReviewForm({ productTitle, onSubmit, idPrefix = "rf" }: { productTitle: string; onSubmit: (d: ReviewDraft) => Promise<void>; idPrefix?: string }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<ProductImage[]>([]);
  const [errors, setErrors] = useState<{ rating?: string; body?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [photoError, setPhotoError] = useState<string>();

  async function addPhotos(files: File[]) {
    setPhotoError(undefined);
    const added: ProductImage[] = [];
    for (const f of files) {
      const problem = checkMedia(f, ["image", "gif"]);
      if (problem) {
        setPhotoError(problem);
        continue;
      }
      try {
        added.push({ id: `ph_${Math.random().toString(36).slice(2, 8)}`, alt: "", src: await putAsset(f) });
      } catch {
        setPhotoError(`${f.name} didn't upload. Try again.`);
      }
    }
    setPhotos((ps) => [...ps, ...added].slice(0, 3));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!rating) next.rating = "Pick a star rating.";
    if (body.trim().length < 10) next.body = "Write a sentence or two so others know what you thought.";
    setErrors(next);
    if (next.rating || next.body) return;
    setPending(true);
    try {
      await onSubmit({ rating: rating as Review["rating"], title, body, photos: photos.map((p, i) => ({ ...p, alt: p.alt.trim() || `Photo ${i + 1} from a buyer of ${productTitle}` })) });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Couldn't post your review." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4" aria-label={`Review ${productTitle}`}>
      {errors.form && <p role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{errors.form}</p>}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">How was {productTitle}?</legend>
        <StarInput value={rating} onChange={(v) => { setRating(v); setErrors((e) => ({ ...e, rating: undefined })); }} invalid={!!errors.rating} />
        {errors.rating && <p className="mt-1 text-sm font-medium text-danger">{errors.rating}</p>}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Headline (optional)</Label>
        <Input id={`${idPrefix}-title`} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Saved me a weekend" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-body`}>Your review</Label>
        <Textarea id={`${idPrefix}-body`} rows={4} value={body} onChange={(e) => { setBody(e.target.value); setErrors((x) => ({ ...x, body: undefined })); }} aria-invalid={!!errors.body || undefined} aria-describedby={`${idPrefix}-body-e`} />
        {errors.body && <p id={`${idPrefix}-body-e`} className="text-sm font-medium text-danger">{errors.body}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Photos (up to 3)</span>
        <span className="-mt-1 text-xs text-muted-foreground">{MEDIA_LIMITS.image.label}, or a GIF up to 5 MB</span>
        <div className="flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <span key={p.id} className="flex w-32 flex-col gap-1.5">
              <span className="relative">
                <ProductImageView image={{ ...p, alt: p.alt || `Photo ${i + 1}` }} size="xs" />
                <button type="button" onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))} aria-label={`Remove photo ${i + 1}`} className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border bg-surface">
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
              <Input aria-label={`Describe photo ${i + 1}`} placeholder="What's in it?" maxLength={120} value={p.alt} onChange={(e) => setPhotos(photos.map((x) => (x.id === p.id ? { ...x, alt: e.target.value } : x)))} className="h-9 text-xs" />
            </span>
          ))}
          {photos.length < 3 && (
            <label className="grid aspect-[4/3] w-24 cursor-pointer place-items-center rounded-media border-2 border-dashed border-border-strong text-muted-foreground hover:border-foreground/40">
              <ImagePlus className="size-5" aria-hidden />
              <span className="sr-only">Add a photo</span>
              <input
                type="file"
                accept={[...MEDIA_LIMITS.image.types, ...MEDIA_LIMITS.gif.types].join(",")}
                multiple
                className="sr-only"
                onChange={(e) => {
                  addPhotos(Array.from(e.target.files ?? []).slice(0, 3 - photos.length));
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        {photoError && <p role="alert" className="text-sm font-medium text-danger">{photoError}</p>}
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Post review
      </Button>
      <p className="text-xs text-muted-foreground">Shown with your first name and initial, marked as a verified buyer.</p>
    </form>
  );
}
