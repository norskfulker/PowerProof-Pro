import type { Session } from "../types";
import { DB_VERSION, freshDb, seedDb, type Db } from "./seed";
import { stressDb } from "./stress";
import type { Store } from "../types";

/**
 * In-memory mock database. Persists to localStorage so the end-to-end walkthrough
 * survives reloads and works across tabs (creator tab sees buyer tab's purchase).
 * Only /lib/api imports this file.
 */

const KEY = "pp:db";
const SESSION_KEY = "pp:session";
const DEMO_KEY = "pp:demo";
const REV_KEY = "pp:rev";
/** "stress" swaps the seed for the QA stress dataset */
const SEED_KEY = "pp:seed";

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
  const stress = seedMode() === "stress";
  const usable = stored && stored.version === DB_VERSION && (stored.mode === "stress") === stress;
  memory = usable ? stored : stress ? stressDb() : seedDb();
  if (!usable) write(KEY, memory);
  return memory;
}

function bumpRev() {
  const next = readRev() + 1;
  lastRev = next;
  write(REV_KEY, next);
}

function readRev(): number {
  return read<number>(REV_KEY) ?? 0;
}

let lastRev = -1;

export function commit(mutator?: (d: Db) => void) {
  const d = db();
  mutator?.(d);
  write(KEY, d);
  bumpRev();
  listeners.forEach((l) => l());
}

function seedMode(): "stress" | "seeded" {
  if (!canStore()) return "seeded";
  try {
    return window.localStorage.getItem(SEED_KEY) === "stress" ? "stress" : "seeded";
  } catch {
    return "seeded";
  }
}

export function resetDb(mode: "seeded" | "fresh" | "stress", store?: Partial<Store>) {
  if (canStore()) {
    try {
      if (mode === "stress") window.localStorage.setItem(SEED_KEY, "stress");
      else window.localStorage.removeItem(SEED_KEY);
    } catch {
      /* private mode */
    }
  }
  memory = mode === "stress" ? stressDb() : mode === "seeded" ? seedDb() : freshDb(Date.now(), store ?? {}, (memory ?? db()).otherStores);
  write(KEY, memory);
  bumpRev();
  listeners.forEach((l) => l());
}

/**
 * Notifies on any change. Other tabs are picked up through the storage event and, as a
 * fallback (some embedded browsers don't deliver it), a cheap revision check on an
 * interval and whenever the tab regains focus.
 */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (typeof window === "undefined") return () => listeners.delete(fn);
  if (lastRev < 0) lastRev = readRev();
  const check = () => {
    const rev = readRev();
    if (rev !== lastRev) {
      lastRev = rev;
      memory = null;
      listeners.forEach((l) => l());
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === REV_KEY) check();
  };
  const onVisible = () => document.visibilityState === "visible" && check();
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(check, 2500);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
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

/** Tells every subscribed screen (and other tabs) that something changed outside the database. */
export function notifyChange() {
  commit();
}
