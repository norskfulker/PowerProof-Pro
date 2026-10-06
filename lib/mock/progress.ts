import { db, getSessionRaw } from "./db";

/**
 * Getting-started progress flags, kept per account (keyed by email) in localStorage so signing out
 * and back in resumes where the creator left off. The backend will store the same object.
 */
export interface ProgressFlags {
  emailVerified: boolean;
  storeConfirmed: boolean;
  shared: boolean;
  customized: { hero: boolean; colors: boolean; about: boolean };
  skipped: string[];
  coachSeen: string[];
  tourSkipped: boolean;
  welcomed: boolean;
  dismissed: boolean;
}

const EMPTY: ProgressFlags = {
  emailVerified: false,
  storeConfirmed: false,
  shared: false,
  customized: { hero: false, colors: false, about: false },
  skipped: [],
  coachSeen: [],
  tourSkipped: false,
  welcomed: false,
  dismissed: false,
};

const key = (email: string) => `pp:progress:${email.toLowerCase()}`;

/** The signed-in account, or (with no session, as in the open demo) the store owner. */
export function accountEmail(): string | undefined {
  return getSessionRaw()?.email ?? (typeof window === "undefined" ? undefined : db().store.ownerEmail);
}

export function readProgress(email = accountEmail()): ProgressFlags {
  if (!email || typeof window === "undefined") return { ...EMPTY, customized: { ...EMPTY.customized } };
  try {
    let raw = window.localStorage.getItem(key(email));
    // The sample store predates the tracker: it starts fully set up, like on login
    if (!raw && db().mode !== "fresh") {
      seedCompleteProgress(email);
      raw = window.localStorage.getItem(key(email));
    }
    const v = raw ? (JSON.parse(raw) as Partial<ProgressFlags>) : {};
    return { ...EMPTY, ...v, customized: { ...EMPTY.customized, ...v.customized } };
  } catch {
    return { ...EMPTY, customized: { ...EMPTY.customized } };
  }
}

export function writeProgress(patch: Partial<ProgressFlags> | ((p: ProgressFlags) => Partial<ProgressFlags>), email = accountEmail()) {
  if (!email || typeof window === "undefined") return;
  const cur = readProgress(email);
  const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
  try {
    window.localStorage.setItem(key(email), JSON.stringify(next));
  } catch {
    /* storage blocked: progress is recomputed from data next time */
  }
  saver?.(next);
}

let saver: ((flags: ProgressFlags) => void) | undefined;

/** With a backend, every change is also saved to the account (profiles.onboarding). */
export function onProgressSaved(fn: (flags: ProgressFlags) => void) {
  saver = fn;
}

/** For accounts created before the tracker existed (the sample store), start fully set up. */
export function seedCompleteProgress(email: string) {
  if (typeof window === "undefined") return;
  const done: ProgressFlags = { ...EMPTY, emailVerified: true, storeConfirmed: true, shared: true, customized: { hero: true, colors: true, about: true }, welcomed: true };
  try {
    window.localStorage.setItem(key(email), JSON.stringify(done));
  } catch {
    /* storage blocked */
  }
}
