"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TerminalSquare } from "lucide-react";
import { getRunLogs, watchRunLogs } from "@/lib/api/agents";
import type { RunLogLine } from "@/lib/types/agents";
import { cn } from "@/lib/utils";

/**
 * The agent's terminal: its real work as it happens. History first (the latest lines), then every
 * new line streams in live (Supabase Realtime); if the live link drops it checks every 15 seconds.
 * `intro` lines sit on top straight away, so the agent shows the moment the terminal opens.
 */

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });

const TONE: Record<RunLogLine["level"], string> = { info: "text-[#c9d1d9]", ok: "text-[#56d364]", warn: "text-[#e3b341]", error: "text-[#ff7b72]" };

export function AgentTerminal({
  instanceId,
  title,
  intro = [],
  toolbar,
  className,
  height = "h-[26rem]",
}: {
  /** Not created yet (launching): only the intro shows */
  instanceId?: string;
  title: string;
  intro?: { text: string; tone?: "cmd" | "ok" | "dim" | "warn" }[];
  /** Buttons in the terminal's top bar (Run now, Preview) */
  toolbar?: React.ReactNode;
  className?: string;
  height?: string;
}) {
  const [lines, setLines] = useState<RunLogLine[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const box = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    if (!instanceId) return;
    let alive = true;
    const merge = (more: RunLogLine[]) =>
      setLines((have) => {
        const ids = new Set(have.map((l) => l.id));
        const add = more.filter((l) => !ids.has(l.id));
        return add.length ? [...have, ...add].sort((a, b) => a.id - b.id).slice(-400) : have;
      });
    const load = () => getRunLogs(instanceId).then((l) => alive && merge(l), () => undefined);
    void load();
    const stop = watchRunLogs(instanceId, (l) => merge([l]), setStatus);
    return () => {
      alive = false;
      stop();
    };
  }, [instanceId]);

  // Offline: catch up every 15 seconds until the live link is back
  useEffect(() => {
    if (!instanceId || status !== "offline") return;
    const t = setInterval(() => void getRunLogs(instanceId).then((l) => setLines((have) => (l.length && l.at(-1)!.id !== have.at(-1)?.id ? l : have)), () => undefined), 15_000);
    return () => clearInterval(t);
  }, [instanceId, status]);

  // Follow new lines unless the person scrolled up to read
  useLayoutEffect(() => {
    const el = box.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [lines.length, intro.length]);

  return (
    <section className={cn("flex flex-col overflow-hidden rounded-card border border-black/40 bg-[#0d1117] text-[#c9d1d9] shadow-sm", className)} aria-label={`${title} terminal`}>
      <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-1.5 text-xs text-white/60">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f56]" />
          <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="size-2.5 rounded-full bg-[#27c93f]" />
        </span>
        <TerminalSquare className="ml-1 size-3.5" aria-hidden />
        <span className="min-w-0 truncate font-mono">{title}</span>
        {instanceId && (
          <span className={cn("ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium", status === "live" ? "bg-[#27c93f]/15 text-[#56d364]" : status === "offline" ? "bg-[#e3b341]/15 text-[#e3b341]" : "text-white/50")} role="status">
            <span className={cn("size-1.5 rounded-full", status === "live" ? "bg-[#56d364] motion-safe:animate-pulse" : status === "offline" ? "bg-[#e3b341]" : "bg-white/40")} aria-hidden />
            {status === "live" ? "Live" : status === "offline" ? "Reconnecting" : "Connecting"}
          </span>
        )}
        {toolbar && <span className="ml-auto flex flex-wrap items-center gap-1.5">{toolbar}</span>}
      </div>
      <div
        ref={box}
        role="log"
        aria-live="polite"
        aria-label={`What ${title} is doing`}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className={cn("overflow-y-auto px-4 py-3 font-mono text-[0.8125rem] leading-6 focus-visible:outline-2 focus-visible:outline-[#56d364]", height)}
      >
        {intro.map((l, i) => (
          <div key={`i${i}`} className={cn("break-words whitespace-pre-wrap", l.tone === "cmd" ? "text-white" : l.tone === "ok" ? "text-[#56d364]" : l.tone === "warn" ? "text-[#e3b341]" : l.tone === "dim" ? "text-white/45" : "")}>
            {l.text}
          </div>
        ))}
        {instanceId && lines.length === 0 && <div className="text-white/45">No activity yet. Lines appear here the moment it starts working.</div>}
        {lines.map((l, i) => {
          // A new run starts a new block
          const sep = !!l.runId && l.runId !== lines[i - 1]?.runId;
          return (
            <div key={l.id}>
              {sep && <div className="mt-2 text-white/30 select-none">── {day(l.at)} ──────────</div>}
              <div className={cn("flex gap-3", TONE[l.level])}>
                <span className="shrink-0 text-white/35 tabular select-none">{time(l.at)}</span>
                <span className="min-w-0 break-words whitespace-pre-wrap">{l.message}</span>
              </div>
            </div>
          );
        })}
        <span className="mt-1 inline-block h-4 w-2 translate-y-0.5 bg-[#c9d1d9] motion-safe:animate-pulse" aria-hidden />
      </div>
    </section>
  );
}

/** A small button for the terminal's top bar */
export function TerminalButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-control border border-white/15 bg-white/5 px-2.5 font-sans text-xs font-semibold text-white/85 hover:bg-white/10 disabled:opacity-50 pointer-coarse:min-h-11 [&_svg]:size-3.5", className)} {...rest}>
      {children}
    </button>
  );
}
