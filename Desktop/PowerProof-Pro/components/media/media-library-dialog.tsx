"use client";

import { useState } from "react";
import { Film, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/pp/empty-state";
import { useApi } from "@/hooks/use-api";
import { getMediaLibrary } from "@/lib/api";
import type { MediaKind } from "@/lib/media/store";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MediaImg } from "./tile-background";

/** Pick a file you already uploaded or made with AI. Only kinds the field accepts are shown. */
export function MediaLibraryDialog({ open, onOpenChange, kinds, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; kinds: MediaKind[]; onPick: (m: MediaItem) => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string>();
  const { data, error, reload } = useApi(() => (open ? getMediaLibrary({ search: q }) : Promise.resolve([])), [open, q]);
  const items = (data ?? []).filter((m) => kinds.includes(m.kind));
  const chosen = items.find((m) => m.id === picked);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Media library</DialogTitle>
          <DialogDescription>Everything you&apos;ve uploaded or made with AI, across your stores.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label="Search the library" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or description" className="pl-9" />
        </div>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState compact title={q ? "Nothing matches" : "Nothing here yet"} body={q ? "Try another word." : "Files you upload or create with AI show up here."} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" role="listbox" aria-label="Files">
            {items.map((m) => (
              <li key={m.id} role="option" aria-selected={picked === m.id}>
                <button
                  type="button"
                  onClick={() => setPicked(m.id)}
                  onDoubleClick={() => {
                    onPick(m);
                    onOpenChange(false);
                  }}
                  className={cn("flex w-full flex-col gap-1.5 rounded-card border bg-surface p-1.5 text-left", picked === m.id ? "border-primary ring-2 ring-primary" : "hover:border-border-strong")}
                  aria-label={`${m.name}${m.kind === "video" ? ", video" : ""}`}
                >
                  <span className="relative block aspect-square overflow-hidden rounded-control bg-muted">
                    {m.kind === "video" ? (
                      <span className="grid h-full place-items-center text-muted-foreground"><Film className="size-6" aria-hidden /></span>
                    ) : (
                      <MediaImg src={m.src} alt={m.alt} decorative className="absolute inset-0" />
                    )}
                    {m.source === "ai" && <Sparkles className="absolute top-1.5 right-1.5 size-4 text-white drop-shadow" aria-hidden />}
                  </span>
                  <span className="truncate px-0.5 text-xs font-medium">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onPick(chosen);
              onOpenChange(false);
            }}
          >
            Use this file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
