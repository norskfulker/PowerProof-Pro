"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { MediaUploader } from "@/components/media/media-uploader";
import { ProductImageView } from "@/components/pp/product-cover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uid } from "@/lib/uid";
import type { MediaRef, ProductImage } from "@/lib/types";

export const MAX_PRODUCT_IMAGES = 8;

/**
 * Up to 8 product images (Part 6A). The first is the cover on the store and in link previews.
 * Reorder with up and down, edit focal point and description, remove, or add more by upload,
 * from the library, or with AI.
 */
export function ImageGalleryField({ images, onChange, title }: { images: ProductImage[]; onChange: (imgs: ProductImage[]) => void; title: string }) {
  const [editing, setEditing] = useState<string>();
  const current = images.find((i) => i.id === editing);
  const move = (i: number, d: -1 | 1) => {
    const next = [...images];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const toRef = (img: ProductImage): MediaRef | undefined => (img.src ? { src: img.src, alt: img.alt, focal: img.focal, kind: "image" } : undefined);

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 && (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Product images, in order">
          {images.map((img, i) => (
            <li key={img.id} className="flex gap-3 rounded-card border bg-surface p-2">
              <div className="relative w-28 shrink-0">
                <ProductImageView image={img} size="xs" />
                {i === 0 && <span className="absolute top-1 left-1 rounded-full bg-accent px-2 py-0.5 font-mono text-[0.625rem] font-semibold text-accent-foreground">COVER</span>}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <p className="truncate text-sm">{img.alt || <span className="text-muted-foreground">No description</span>}</p>
                <div className="flex flex-wrap gap-1 pointer-coarse:gap-2">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move image ${i + 1} up${i === 1 ? " (make it the cover)" : ""}`}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label={`Move image ${i + 1} down`}><ArrowDown /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(img.id)} aria-label={`Edit image ${i + 1}`}><Pencil /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-danger" onClick={() => onChange(images.filter((x) => x.id !== img.id))} aria-label={`Remove image ${i + 1}`}><Trash2 /></Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {images.length < MAX_PRODUCT_IMAGES ? (
        <MediaUploader
          key={images.length}
          label={images.length ? `Add another image (${images.length} of ${MAX_PRODUCT_IMAGES})` : "Add the cover image"}
          kinds={["image", "gif"]}
          aiPurpose="product_cover"
          withFocal={false}
          withAlt={false}
          value={undefined}
          onChange={(m) => m && onChange([...images, { id: uid("img"), src: m.src, alt: m.alt || title || "Product image", focal: m.focal }])}
        />
      ) : (
        <p className="text-sm text-muted-foreground">That&apos;s {MAX_PRODUCT_IMAGES} images, the most a product can have. Remove one to add another.</p>
      )}

      <Dialog open={!!current} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit image</DialogTitle>
            <DialogDescription>Set what stays in frame when it&apos;s cropped, and describe it for screen readers.</DialogDescription>
          </DialogHeader>
          {current &&
            (current.src ? (
              <MediaUploader
                label="Image"
                kinds={["image", "gif"]}
                aiPurpose="product_cover"
                value={toRef(current)}
                onChange={(m) => (m ? onChange(images.map((x) => (x.id === current.id ? { ...x, src: m.src, alt: m.alt, focal: m.focal } : x))) : (onChange(images.filter((x) => x.id !== current.id)), setEditing(undefined)))}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <ProductImageView image={current} />
                <p className="text-sm text-muted-foreground">This is a generated cover. Replace it with an upload or an AI image:</p>
                <MediaUploader label="Replace with" kinds={["image", "gif"]} aiPurpose="product_cover" value={undefined} onChange={(m) => m && onChange(images.map((x) => (x.id === current.id ? { id: x.id, src: m.src, alt: m.alt || x.alt, focal: m.focal } : x)))} />
              </div>
            ))}
          <DialogFooter>
            <Button onClick={() => setEditing(undefined)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
