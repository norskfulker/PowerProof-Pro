"use client";

import { ImageOff } from "lucide-react";
import { useMediaUrl } from "@/hooks/use-media-url";
import type { Focal, TileBackground } from "@/lib/types";
import { cn } from "@/lib/utils";

/** An uploaded image or https URL with a focal point; a quiet placeholder if the file is missing. */
export function MediaImg({ src, alt, focal, className, fit = "cover", decorative }: { src: string; alt: string; focal?: Focal; className?: string; fit?: "cover" | "contain"; decorative?: boolean }) {
  const { url, missing, loading } = useMediaUrl(src);
  if (missing || !src) {
    return (
      <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : missing ? `${alt || "Image"} (not available on this device)` : "No image"} aria-hidden={decorative || undefined}>
        <ImageOff className="size-6" aria-hidden />
      </div>
    );
  }
  if (loading || !url) return <div className={cn("animate-pulse bg-muted", className)} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={decorative ? "" : alt} loading="lazy" className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain", className)} style={focal ? { objectPosition: `${focal.x}% ${focal.y}%` } : undefined} />;
}

/** Looping, muted background video. Phones and reduced-motion users see the poster instead. */
export function MediaVideoBackground({ src, poster, focal }: { src: string; poster: string; focal: Focal }) {
  const video = useMediaUrl(src);
  return (
    <>
      <MediaImg src={poster} alt="" decorative focal={focal} className="absolute inset-0" />
      {video.url && (
        <video src={video.url} autoPlay muted loop playsInline aria-hidden className="absolute inset-0 hidden h-full w-full object-cover motion-safe:md:block" style={{ objectPosition: `${focal.x}% ${focal.y}%` }} />
      )}
    </>
  );
}

/**
 * Renders a tile or section background (colour, image or video) with its overlay, behind children.
 * Used by collection tiles, product cards without images, heroes and the background picker preview.
 */
export function TileBackgroundView({ bg, className, children, label }: { bg: TileBackground; className?: string; children?: React.ReactNode; label?: string }) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)} style={bg.kind === "color" ? { background: bg.color } : undefined} role={label ? "img" : undefined} aria-label={label}>
      {bg.kind === "image" && <MediaImg src={bg.src} alt={bg.alt} focal={bg.focal} decorative={!!label || !bg.alt} className="absolute inset-0 -z-10" />}
      {bg.kind === "video" && (
        <div className="absolute inset-0 -z-10" aria-hidden>
          <MediaVideoBackground src={bg.src} poster={bg.poster} focal={bg.focal} />
        </div>
      )}
      {!!bg.overlay && <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: bg.overlay }} aria-hidden />}
      {children}
    </div>
  );
}
