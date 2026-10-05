import { db, getSessionRaw, resetDb, setSessionRaw } from "../mock/db";
import { slugify } from "../mock/random";
import type { Session } from "../types";
import { ApiError, call } from "./client";

/**
 * Mock auth. Any email + password of 8+ characters signs in to the seeded demo store.
 * Signing up starts a brand-new empty store (the "fresh" mode) so onboarding is real.
 */

export function getSession(): Session | null {
  return getSessionRaw();
}

export function login(email: string, password: string): Promise<Session> {
  return call(() => {
    if (password.length < 8) throw new ApiError("That email and password don't match. Try again or use a login link.", "validation");
    const d = db();
    const s: Session = { name: d.store.ownerName, email: email.toLowerCase(), storeId: d.store.id };
    setSessionRaw(s);
    return s;
  });
}

export function sendLoginLink(email: string): Promise<void> {
  return call(() => {
    if (!email.includes("@")) throw new ApiError("Enter the email you signed up with.", "validation");
  });
}

export function signup(name: string, email: string): Promise<Session> {
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
    return s;
  });
}

export function verifyEmail(code: string): Promise<void> {
  return call(() => {
    if (!/^\d{6}$/.test(code)) throw new ApiError("Codes are 6 digits. Check the email we sent.", "validation");
    if (code === "000000") throw new ApiError("That code has expired. We've sent a fresh one.", "validation");
  });
}

export function requestPasswordReset(email: string): Promise<void> {
  return call(() => {
    if (!email.includes("@")) throw new ApiError("Enter a valid email.", "validation");
  });
}

export function logout(): Promise<void> {
  return call(() => setSessionRaw(null), { fast: true });
}
