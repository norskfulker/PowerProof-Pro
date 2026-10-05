import type { Session } from "../types";
import { DB_VERSION, freshDb, seedDb, type Db } from "./seed";
import type { Store } from "../types";

/**
 * In-memory mock database. Persists to localStorage so the end-to-end walkthrough
 * survives reloads and works across tabs (creator tab sees buyer tab's purchase).
 * Only /lib/api imports this file.
 */

const KEY = "pp:db";
const SESSION_KEY = "pp:session";
const DEMO_KEY = "pp:demo";

export interface DemoSettings {
  /** Force every API call to fail, to review error states. */
  fail: boolean;
  /** Add latency to every call (ms range). */
  latency: [number, number];
}

const DEFAULT_DEMO: DemoSettings = { fail: false, latency: [300, 600] };

let memory: Db | null = null;
const listeners = new Set<() => void>();

function canStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read<T>(key: string): T | null {
  if (!canStore()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode: keep working in memory */
  }
}

export function db(): Db {
  if (memory) return memory;
  const stored = read<Db>(KEY);
  memory = stored && stored.version === DB_VERSION ? stored : seedDb();
  if (!stored) write(KEY, memory);
  return memory;
}

export function commit(mutator?: (d: Db) => void) {
  const d = db();
  mutator?.(d);
  write(KEY, d);
  listeners.forEach((l) => l());
}

export function resetDb(mode: "seeded" | "fresh", store?: Partial<Store>) {
  memory = mode === "seeded" ? seedDb() : freshDb(Date.now(), store ?? {});
  write(KEY, memory);
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      memory = null;
      fn();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function getDemo(): DemoSettings {
  return { ...DEFAULT_DEMO, ...(read<Partial<DemoSettings>>(DEMO_KEY) ?? {}) };
}

export function setDemo(next: Partial<DemoSettings>) {
  write(DEMO_KEY, { ...getDemo(), ...next });
  listeners.forEach((l) => l());
}

export function getSessionRaw(): Session | null {
  return read<Session>(SESSION_KEY);
}

export function setSessionRaw(s: Session | null) {
  if (!canStore()) return;
  if (s) write(SESSION_KEY, s);
  else window.localStorage.removeItem(SESSION_KEY);
}

export type { Db };
