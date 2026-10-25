import type { LiveStatus } from "@/lib/api/activity";
import { cn } from "@/lib/utils";

const COPY: Record<LiveStatus, { label: string; hint: string }> = {
  live: { label: "Live", hint: "Updates appear as they happen" },
  connecting: { label: "Connecting", hint: "Connecting to live updates" },
  offline: { label: "Reconnecting", hint: "Live updates paused: refreshing every 30 seconds until they're back" },
};

/** Whether the screen's numbers are current: a green dot when live updates are connected */
export function LiveStatusBadge({ status, className }: { status: LiveStatus; className?: string }) {
  const c = COPY[status];
  return (
    <span role="status" title={c.hint} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", status === "live" ? "border-success/30 text-success" : status === "offline" ? "border-warning/40 text-warning-ink" : "text-muted-foreground", className)}>
      <span className="relative flex size-2" aria-hidden>
        {status === "live" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />}
        <span className={cn("relative inline-flex size-2 rounded-full", status === "live" ? "bg-success" : status === "offline" ? "bg-warning" : "bg-muted-foreground")} />
      </span>
      {c.label}
      <span className="sr-only">: {c.hint}</span>
    </span>
  );
}
