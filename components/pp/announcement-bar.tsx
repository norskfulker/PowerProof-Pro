"use client";

import { useState } from "react";
import { Copy, X } from "lucide-react";
import type { Announcement } from "@/lib/types";
import { copyText } from "./copy-field";
import { CountdownTimer } from "./countdown-timer";

export function AnnouncementBar({ announcement }: { announcement: Announcement }) {
  const [closed, setClosed] = useState(false);
  const [now] = useState(() => Date.now());
  if (closed || !announcement.text) return null;
  const live = !announcement.endsAt || Date.parse(announcement.endsAt) > now;
  if (!live) return null;
  return (
    <div className="relative bg-primary text-primary-foreground" role="region" aria-label="Announcement">
      <div className="mx-auto flex min-h-11 max-w-[1200px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-14 py-2 text-center text-sm">
        <span className="font-semibold">{announcement.text}</span>
        {announcement.code && (
          <button
            type="button"
            onClick={() => copyText(announcement.code!, `Code ${announcement.code} copied`)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-dashed pointer-coarse:min-h-11 border-primary-foreground/50 px-3 font-mono text-xs tracking-wider hover:bg-primary-foreground/10"
            aria-label={`Copy code ${announcement.code}`}
          >
            {announcement.code} <Copy className="size-3" aria-hidden />
          </button>
        )}
        {announcement.endsAt && (
          <span className="inline-flex items-center gap-1.5 text-primary-foreground/80">
            Ends in <CountdownTimer endsAt={announcement.endsAt} compact className="text-primary-foreground" />
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Dismiss announcement"
        className="absolute top-0 right-1 grid size-11 place-items-center text-primary-foreground/70 hover:text-primary-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
