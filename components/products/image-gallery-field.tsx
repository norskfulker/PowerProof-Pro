"use client";

import { useState } from "react";
import { ImagePlus, Palette, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ImageMaker } from "@/components/pp/image-maker";
import { ProductImageView } from "@/components/pp/product-cover";
import type { ProductImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Images for a product: upload, make one in the image maker, reorder by picking a cover, remove. */
export function ImageGalleryField({
  images,
  onChange,
  title,
}: {
  images: ProductImage[];
  onChange: (imgs: ProductImage[]) => void;
  title: string;
}) {
  const [makerOpen, setMakerOpen] = useState(false);
  const id = "img-upload";

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <li key={img.id} className="group relative">
            <ProductImageView image={img} size="sm" className={cn(i === 0 && "outline-2 outline-offset-2 outline-accent")} />
            {i === 0 && (
              <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 font-mono text-[0.625rem] font-semibold text-accent-foreground">COVER</span>
            )}
            <div className="absolute top-1.5 right-1.5 flex gap-2">
              {i > 0 && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  aria-label="Make this the cover"
                  onClick={() => onChange([img, ...images.filter((x) => x.id !== img.id)])}
                >
                  <Star />
                </Button>
              )}
              <Button type="button" size="icon-sm" variant="secondary" aria-label={`Remove ${img.alt}`} onClick={() => onChange(images.filter((x) => x.id !== img.id))}>
                <X />
              </Button>
            </div>
          </li>
        ))}
        <li className="flex flex-col gap-2">
          <label
            htmlFor={id}
            className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-media border-2 border-dashed border-border-strong bg-surface text-sm font-medium hover:border-foreground/40"
          >
            <ImagePlus className="size-5 text-primary" aria-hidden />
            Upload image
            <input
              id={id}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 8);
                onChange([
                  ...images,
                  ...files.map((f) => ({ id: `img_${Math.random().toString(36).slice(2, 8)}`, alt: f.name.replace(/\.[^.]+$/, ""), src: URL.createObjectURL(f) })),
                ]);
                e.target.value = "";
              }}
            />
          </label>
        </li>
      </ul>
      <Button type="button" variant="secondary" className="self-start" onClick={() => setMakerOpen(true)}>
        <Palette aria-hidden /> Make a cover in the image maker
      </Button>
      <Sheet open={makerOpen} onOpenChange={setMakerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">Image maker</SheetTitle>
            <SheetDescription>Pick a template, change the words and colours, then add it to this product.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <ImageMaker
              initial={{ template: "split", title: title || "Your product", subtitle: "Digital download", bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" }}
              onUse={(spec) => {
                onChange([{ id: `img_${Math.random().toString(36).slice(2, 8)}`, alt: `${spec.title} cover`, cover: spec }, ...images]);
                setMakerOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
