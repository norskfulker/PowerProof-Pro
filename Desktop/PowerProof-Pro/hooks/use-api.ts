"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onDataChange } from "@/lib/api";

/** A request that never answers becomes an error with a Retry button, never an endless spinner. */
const GIVE_UP_MS = 30_000;
function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("This is taking too long. Check your connection and try again.")), GIVE_UP_MS);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e))
    );
  });
}

export interface ApiState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  /** Refetch and show the loading state again. */
  reload: () => void;
  /** Replace data locally after a mutation. */
  setData: (d: T) => void;
}

interface Snapshot<T> {
  key?: string;
  data?: T;
  error?: string;
}

/**
 * Fetches through /lib/api with real loading, error and success states.
 * `live: true` quietly refetches whenever data changes (this tab or another).
 * `deps` must be primitives: they form the request key.
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = [], opts: { live?: boolean } = {}): ApiState<T> {
  const [tick, setTick] = useState(0);
  const [snap, setSnap] = useState<Snapshot<T>>({});
  const fnRef = useRef(fn);
  const key = `${JSON.stringify(deps)}#${tick}`;

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let alive = true;
    withTimeout(fnRef.current()).then(
      (data) => alive && setSnap({ key, data }),
      (e: unknown) => alive && setSnap((s) => ({ key, data: s.data, error: e instanceof Error ? e.message : "Something went wrong." }))
    );
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!opts.live) return;
    return onDataChange(() => {
      fnRef.current().then(
        (data) => setSnap((s) => ({ ...s, data, error: undefined })),
        () => {
          /* keep showing the last good data */
        }
      );
    });
  }, [opts.live]);

  const loading = snap.key !== key;
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T) => setSnap((s) => ({ ...s, data })), []);
  return { data: snap.data, error: loading ? undefined : snap.error, loading, reload, setData };
}

/** Wraps a mutation with pending state. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const run = useCallback(async (...args: A): Promise<R> => {
    setPending(true);
    try {
      return await fnRef.current(...args);
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending };
}
