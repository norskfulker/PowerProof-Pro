import { getSessionRaw } from "./local";

/**
 * Getting-started flags (checklist ticks, dismissed tips). They are saved to profiles.onboarding;
 * the copy here is a per-account cache so the checklist reads synchronously.
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
  /** The creator's colour mode, kept on the account so it follows them to other devices */
  theme?: "light" | "dark";
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
const empty = (): ProgressFlags => ({ ...EMPTY, customized: { ...EMPTY.customized } });

export function accountEmail(): string | undefined {
  return getSessionRaw()?.email;
}

export function readProgress(email = accountEmail()): ProgressFlags {
  if (!email || typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(key(email));
    const v = raw ? (JSON.parse(raw) as Partial<ProgressFlags>) : {};
    return { ...EMPTY, ...v, customized: { ...EMPTY.customized, ...v.customized } };
  } catch {
    return empty();
  }
}

export function writeProgress(patch: Partial<ProgressFlags> | ((p: ProgressFlags) => Partial<ProgressFlags>), email = accountEmail()) {
  if (!email || typeof window === "undefined") return;
  const cur = readProgress(email);
  const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
  try {
    window.localStorage.setItem(key(email), JSON.stringify(next));
  } catch {
    /* storage blocked: the flags are saved to the account below */
  }
  saver?.(next);
}

let saver: ((flags: ProgressFlags) => void) | undefined;

/** Every change is also saved to the account (profiles.onboarding). */
export function onProgressSaved(fn: (flags: ProgressFlags) => void) {
  saver = fn;
}
