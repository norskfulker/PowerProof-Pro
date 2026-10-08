"use client";

import { useId, useRef, useState } from "react";
import { AlertTriangle, Film, ImagePlus, Library, Loader2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMediaUrl } from "@/hooks/use-media-url";
import { uploadMedia } from "@/lib/api";
import { MEDIA_LIMITS, type MediaKind } from "@/lib/media/store";
import type { AiPurpose, MediaItem, MediaRef } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FocalPointPicker } from "./focal-point-picker";
import { MediaLibraryDialog } from "./media-library-dialog";
import { MediaImg } from "./tile-background";

const ASPECT_CLASS = { "1:1": "aspect-square", "4:3": "aspect-[4/3]", "16:9": "aspect-video", "4:5": "aspect-[4/5]", "3:1": "aspect-[3/1]" } as const;

function VideoPreview({ src, poster }: { src: string; poster?: string }) {
  const v = useMediaUrl(src);
  const p = useMediaUrl(poster);
  if (!v.url) return <div className="grid h-full place-items-center bg-muted text-muted-foreground"><Film className="size-6" aria-hidden /></div>;
  return <video src={v.url} poster={p.url} controls muted preload="metadata" className="h-full w-full bg-black object-contain" />;
}

/**
 * The one uploader used everywhere (Part 6A). Drag and drop, click to pick, or paste; progress with
 * cancel; preview with replace and remove; focal point; alt text; optional poster for video; pick
 * from the library or create with AI. Limits are shown up front and checked before uploading.
 */
export function MediaUploader({
  label,
  value,
  onChange,
  kinds,
  aspect = "4:3",
  hint,
  withAlt = true,
  withFocal = true,
  withPoster = true,
  compact,
  className,
}: {
  label: string;
  value?: MediaRef;
  onChange: (v: MediaRef | undefined) => void;
  kinds: MediaKind[];
  aspect?: keyof typeof ASPECT_CLASS;
  hint?: string;
  withAlt?: boolean;
  withFocal?: boolean;
  /** Videos get an optional poster image */
  withPoster?: boolean;
  /** Shows "Create with AI" next to Upload */
  aiPurpose?: AiPurpose;
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [library, setLibrary] = useState(false);
  const accept = kinds.flatMap((k) => MEDIA_LIMITS[k].types).join(",");
  const kind = value?.kind ?? (value?.src ? "image" : undefined);
  const limits = kinds.map((k) => MEDIA_LIMITS[k].label).join(" · ");

  async function upload(file?: File | null) {
    if (!file) return;
    setError(undefined);
    abort.current = new AbortController();
    setProgress(0);
    try {
      const item = await uploadMedia(file, { kinds, onProgress: setProgress, signal: abort.current.signal, alt: value?.alt });
      onChange({ src: item.src, alt: value?.alt || "", kind: item.kind, focal: { x: 50, y: 50 } });
      if (item.saved && item.saved > 50 * 1024) toast.success(`Shrunk to ${formatBytes(item.size)}`, { description: `Saved ${formatBytes(item.saved)} of your storage.` });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "The upload didn't finish. Try again.");
    } finally {
      setProgress(null);
      abort.current = null;
      if (input.current) input.current.value = "";
    }
  }

  function pick(m: MediaItem) {
    if (!kinds.includes(m.kind)) return setError(`This field takes ${limits}.`);
    setError(undefined);
    onChange({ src: m.src, alt: m.alt, kind: m.kind, focal: { x: 50, y: 50 } });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
        </span>
        {value?.src && <span className="text-xs text-muted-foreground">{kind === "video" ? "Video" : kind === "gif" ? "GIF" : "Image"}</span>}
      </div>
      <input ref={input} id={`${id}-file`} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-label={`Upload ${label}`} onChange={(e) => upload(e.target.files?.[0])} />

      {value?.src ? (
        <div className="flex flex-col gap-2">
          <div className={cn("relative w-full overflow-hidden rounded-media border bg-muted", compact ? "max-w-48" : "max-w-md", ASPECT_CLASS[aspect])}>
            {kind === "video" ? (
              <VideoPreview src={value.src} poster={value.poster} />
            ) : withFocal ? (
              <FocalPointPicker value={value.focal ?? { x: 50, y: 50 }} onChange={(focal) => onChange({ ...value, focal })} className="h-full w-full">
                <MediaImg src={value.src} alt={value.alt} focal={value.focal} className="pointer-events-none absolute inset-0" />
              </FocalPointPicker>
            ) : (
              <MediaImg src={value.src} alt={value.alt} focal={value.focal} className="absolute inset-0" />
            )}
          </div>
          {withFocal && kind !== "video" && <p className="text-xs text-muted-foreground">Click the picture (or use arrow keys) to set what stays in frame when it&apos;s cropped.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={progress !== null}>
              <RefreshCw aria-hidden /> Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setLibrary(true)}>
              <Library aria-hidden /> Library
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => onChange(undefined)}>
              <Trash2 aria-hidden /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="group"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-limits`}
          tabIndex={0}
          onPaste={(e) => {
            const f = [...e.clipboardData.files][0];
            if (f) {
              e.preventDefault();
              upload(f);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-media border-2 border-dashed border-border-strong bg-surface px-4 text-center outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary",
            compact ? "py-4" : "py-7",
            drag && "border-primary bg-primary-soft"
          )}
        >
          {progress !== null ? (
            <div className="flex w-full max-w-xs flex-col items-center gap-2" role="status" aria-live="polite">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
              <span className="text-sm font-medium">Uploading… {progress}%</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => abort.current?.abort()}>
                <X aria-hidden /> Cancel
              </Button>
            </div>
          ) : (
            <>
              {kinds.includes("video") && !kinds.includes("image") ? <Film className="size-6 text-primary" aria-hidden /> : <ImagePlus className="size-6 text-primary" aria-hidden />}
              <p className="text-sm">
                <span className="font-medium">Drop a file here</span>, paste it, or
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" onClick={() => input.current?.click()}>
                  <Upload aria-hidden /> Upload
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setLibrary(true)}>
                  <Library aria-hidden /> Library
                </Button>
              </div>
            </>
          )}
          <p id={`${id}-limits`} className="text-xs text-muted-foreground">
            {limits}
            {hint ? ` · ${hint}` : ""}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}

      {value?.src && withAlt && kind !== "video" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-alt`}>Describe the picture</Label>
          <Input id={`${id}-alt`} value={value.alt} maxLength={200} onChange={(e) => onChange({ ...value, alt: e.target.value })} placeholder="What a screen reader should say" />
        </div>
      )}
      {value?.src && kind === "video" && withPoster && (
        <MediaUploader compact label="Poster image (optional)" hint="Shown before play, on phones, and with reduced motion" value={value.poster ? { src: value.poster, alt: "" } : undefined} onChange={(p) => onChange({ ...value, poster: p?.src })} kinds={["image"]} aspect={aspect} withAlt={false} withFocal={false} withPoster={false} />
      )}

      <MediaLibraryDialog open={library} onOpenChange={setLibrary} kinds={kinds} onPick={pick} />
    </div>
  );
}
