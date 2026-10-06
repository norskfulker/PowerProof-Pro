import { db, getSessionRaw, resetDb, setSessionRaw } from "../mock/db";
import { seedCompleteProgress, writeProgress } from "../mock/progress";
import { slugify } from "../mock/random";
import type { Session } from "../types";
import { ApiError, call } from "./client";
import { isLive } from "../supabase/env";
import * as live from "./live/auth";

/**
 * Mock auth. Any email + password of 8+ characters signs in to the seeded demo store.
 * Signing up starts a brand-new empty store (the "fresh" mode) so onboarding is real.
 */

export function getSession(): Session | null {
  return getSessionRaw();
}

export function login(email: string, password: string): Promise<Session> {
  if (isLive()) return live.login(email, password);
  return call(() => {
    if (password.length < 8) throw new ApiError("That email and password don't match. Try again or use a login link.", "validation");
    const d = db();
    const s: Session = { name: d.store.ownerName, email: email.toLowerCase(), storeId: d.store.id };
    setSessionRaw(s);
    // The sample store predates the getting-started tracker: start it fully set up
    if (d.mode !== "fresh" && typeof window !== "undefined" && !window.localStorage.getItem(`pp:progress:${s.email}`)) seedCompleteProgress(s.email);
    return s;
  });
}

export function sendLoginLink(email: string): Promise<void> {
  if (isLive()) return live.sendLoginLink(email);
  return call(() => {
    if (!email.includes("@")) throw new ApiError("Enter the email you signed up with.", "validation");
  });
}

/** Google sign-in. Leaves the page for Google and comes back through /auth/callback. */
export function signInWithGoogle(next?: string): Promise<void> {
  if (isLive()) return live.signInWithGoogle(next);
  return Promise.reject(new ApiError("Google sign-in needs the live backend. Use email for the demo.", "validation"));
}

export function signup(name: string, email: string, password?: string): Promise<Session> {
  if (isLive()) return live.signup(name, email, password);
  return call(() => {
    if (email.toLowerCase().endsWith("@taken.com")) throw new ApiError("There's already an account with this email. Log in instead.", "conflict");
    const first = name.trim().split(" ")[0] || "My";
    resetDb("fresh", {
      ownerName: name.trim(),
      ownerEmail: email.toLowerCase(),
      name: `${first}'s Store`,
      tagline: `Digital downloads by ${name.trim()}.`,
      supportEmail: email.toLowerCase(),
      slug: slugify(first) || "my-store",
      logoText: name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "PP",
    });
    const s: Session = { name: name.trim(), email: email.toLowerCase(), storeId: db().store.id };
    setSessionRaw(s);
    // A new account starts the checklist from zero
    writeProgress({ emailVerified: false, storeConfirmed: false, shared: false, customized: { hero: false, colors: false, about: false }, skipped: [], coachSeen: [], tourSkipped: false, welcomed: false, dismissed: false }, s.email);
    return s;
  });
}

export function verifyEmail(code: string, email?: string): Promise<void> {
  if (isLive()) return live.verifyEmail(code, email);
  return call(() => {
    if (!/^\d{6}$/.test(code)) throw new ApiError("Codes are 6 digits. Check the email we sent.", "validation");
    if (code === "000000") throw new ApiError("That code has expired. We've sent a fresh one.", "validation");
    writeProgress({ emailVerified: true });
  });
}

export function resendVerification(email: string): Promise<void> {
  if (isLive()) return live.resendVerification(email);
  return call(() => undefined, { fast: true });
}

export function requestPasswordReset(email: string): Promise<void> {
  if (isLive()) return live.requestPasswordReset(email);
  return call(() => {
    if (!email.includes("@")) throw new ApiError("Enter a valid email.", "validation");
  });
}

/** Sets a new password after following a reset link (the link signs the creator in). */
export function updatePassword(password: string): Promise<void> {
  if (isLive()) return live.updatePassword(password);
  return call(() => {
    if (password.length < 8) throw new ApiError("Use at least 8 characters. A short sentence works well.", "validation");
  });
}

export function logout(): Promise<void> {
  if (isLive()) return live.logout();
  return call(() => setSessionRaw(null), { fast: true });
}
