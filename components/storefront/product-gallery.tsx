"use client";

import { useState } from "react";
import { PlayCircle, ZoomIn, ZoomOut } from "lucide-react";
import { ProductImageView } from "@/components/pp/product-cover";
import type { ProductImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Gallery with click-to-zoom (follows the pointer) and an optional preview video slot. */
export function ProductGallery({ images, title, hasVideo }: { images: ProductImage[]; title: string; hasVideo?: boolean }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const showingVideo = hasVideo && active === images.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-card border bg-surface">
        {showingVideo ? (
          <div className="grid aspect-[4/3] place-items-center bg-foreground text-center text-primary-foreground">
            <span className="flex flex-col items-center gap-2 px-6">
              <PlayCircle className="size-12" aria-hidden />
              <span className="font-semibold">Preview video</span>
              <span className="text-sm opacity-80">The creator&apos;s walkthrough plays here.</span>
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
            }}
            aria-label={zoom ? "Zoom out" : `Zoom in on ${title}`}
            aria-pressed={zoom}
            className={cn("block w-full", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
          >
            <span className="block transition-transform duration-200 ease-out" style={{ transform: zoom ? "scale(2)" : "scale(1)", transformOrigin: origin }}>
              <ProductImageView image={images[active]} size="lg" className="rounded-none" />
            </span>
            <span className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-surface/90 text-foreground" aria-hidden>
              {zoom ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
            </span>
          </button>
        )}
      </div>
      {(images.length > 1 || hasVideo) && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => { setActive(i); setZoom(false); }}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-pressed={i === active}
              className={cn("w-20 shrink-0 overflow-hidden rounded-media", i === active ? "outline-2 outline-offset-2 outline-primary" : "opacity-70 hover:opacity-100")}
            >
              <ProductImageView image={img} size="xs" />
            </button>
          ))}
          {hasVideo && (
            <button
              type="button"
              onClick={() => setActive(images.length)}
              aria-label="Show preview video"
              aria-pressed={showingVideo}
              className={cn("grid aspect-[4/3] w-20 shrink-0 place-items-center rounded-media bg-foreground text-primary-foreground", showingVideo ? "outline-2 outline-offset-2 outline-primary" : "opacity-80")}
            >
              <PlayCircle className="size-6" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
