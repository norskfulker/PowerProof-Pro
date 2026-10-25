"use client";

import { useEffect, useRef, useState } from "react";
import { watchStore, type LiveStatus } from "@/lib/api/activity";

/**
 * Re-runs `onChange` when any of these tables changes for the active store (Supabase Realtime),
 * at most once every `throttleMs`, and reports whether live updates are connected. While offline
 * it falls back to polling every `pollMs`, so the screen never silently goes stale.
 */
export function useLiveStore(tables: string[], onChange: () => void, { throttleMs = 1500, pollMs = 30_000 } = {}): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const cb = useRef(onChange);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    cb.current = onChange;
  });
  const key = tables.join(",");

  useEffect(() => {
    const fire = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = undefined;
        cb.current();
      }, throttleMs);
    };
    const stop = watchStore(key.split(","), fire, setStatus);
    return () => {
      stop();
      clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [key, throttleMs]);

  useEffect(() => {
    if (status === "live") return;
    const t = setInterval(() => cb.current(), pollMs);
    return () => clearInterval(t);
  }, [status, pollMs]);

  return status;
}
