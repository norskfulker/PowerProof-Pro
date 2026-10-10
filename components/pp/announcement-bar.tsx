"use client";

import { useState } from "react";
import { Copy, X } from "lucide-react";
import type { Announcement } from "@/lib/types";
import { copyText } from "./copy-field";
import { CountdownTimer } from "./countdown-timer";
import { Marquee } from "./marquee";
import { cn } from "@/lib/utils";

const TONE = { brand: "bg-primary text-primary-foreground", dark: "bg-foreground text-background", soft: "bg-primary-soft text-primary" } as const;
const JUSTIFY = { left: "justify-start", center: "justify-center", right: "justify-end" } as const;

export function AnnouncementBar({ announcement, href, editing }: { announcement: Announcement; /** Where the message goes, when it is a link */ href?: string; /** In the store editor: shown even when empty or ended */ editing?: boolean }) {
  const [closed, setClosed] = useState(false);
  const [now] = useState(() => Date.now());
  if ((closed && !editing) || (!announcement.text && !editing)) return null;
  const live = !announcement.endsAt || Date.parse(announcement.endsAt) > now;
  if (!live && !editing) return null;
  const text = announcement.text || <span className="opacity-60">Add your announcement</span>;
  const message = href ? <a href={href} className="underline underline-offset-4">{text}</a> : text;
  return (
    <div className={cn("relative", TONE[announcement.tone ?? "brand"])} role="region" aria-label="Announcement">
      <div className={cn("mx-auto flex min-h-11 max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 px-14 py-2 text-sm", announcement.scroll ? "justify-center" : cn(JUSTIFY[announcement.align ?? "center"], announcement.align === "left" ? "text-left" : announcement.align === "right" ? "text-right" : "text-center"))}>
        {announcement.scroll ? (
          <Marquee label={announcement.text} speed="slow" className="min-w-0 flex-1">
            {Array.from({ length: 4 }, (_, i) => <span key={i} className="pr-12 font-semibold whitespace-nowrap">{message}</span>)}
          </Marquee>
        ) : (
          <span className="font-semibold">{message}</span>
        )}
        {announcement.code && (
          <button
            type="button"
            onClick={() => copyText(announcement.code!, `Code ${announcement.code} copied`)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-dashed pointer-coarse:min-h-11 border-current/50 px-3 font-mono text-xs tracking-wider hover:bg-current/10"
            aria-label={`Copy code ${announcement.code}`}
          >
            {announcement.code} <Copy className="size-3" aria-hidden />
          </button>
        )}
        {announcement.endsAt && (
          <span className="inline-flex items-center gap-1.5">
            Ends in <CountdownTimer endsAt={announcement.endsAt} compact className="text-current" />
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Dismiss announcement"
        className="absolute top-0 right-1 grid size-11 place-items-center opacity-70 hover:opacity-100"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
