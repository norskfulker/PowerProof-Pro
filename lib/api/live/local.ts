import type { Session } from "../../types";

/**
 * The only things kept in the browser: a copy of who is signed in (so the UI can read it without
 * waiting for a request) and a change signal between tabs. Neither holds business data; the
 * database is the source of truth and every screen re-reads it from there.
 */

const SESSION_KEY = "pp:session";
const REV_KEY = "pp:rev";

const listeners = new Set<() => void>();
let lastRev = -1;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getSessionRaw(): Session | null {
  try {
    const raw = storage()?.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSessionRaw(s: Session | null) {
  const st = storage();
  if (!st) return;
  try {
    if (s) st.setItem(SESSION_KEY, JSON.stringify(s));
    else st.removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
}

function readRev(): number {
  try {
    return Number(storage()?.getItem(REV_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Tells every subscribed screen, in this tab and in others, to read the database again. */
export function notifyChange() {
  const next = readRev() + 1;
  lastRev = next;
  try {
    storage()?.setItem(REV_KEY, String(next));
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

/** Calls `fn` after any change made in this tab, or in another tab of the same browser. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (typeof window === "undefined") return () => listeners.delete(fn);
  if (lastRev < 0) lastRev = readRev();
  const onStorage = (e: StorageEvent) => {
    if (e.key !== REV_KEY) return;
    const rev = readRev();
    if (rev !== lastRev) {
      lastRev = rev;
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}
