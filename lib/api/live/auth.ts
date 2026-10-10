import { sb } from "../../supabase/browser";
import type { Session } from "../../types";
import { ApiError } from "../client";
import { clearSession, syncSession } from "./session";

/** Supabase Auth: email + password, email links and codes, and Google. */

const site = () => (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL ?? "");
const callback = (next: string) => `${site()}/auth/callback?next=${encodeURIComponent(next)}`;
const PENDING = "pp:pending-email";

function authError(message: string): never {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) throw new ApiError("That email and password don't match. Try again or use a login link.", "validation");
  if (m.includes("not confirmed")) throw new ApiError("Confirm your email first. We've sent you a code.", "validation");
  if (m.includes("already registered") || m.includes("already been registered")) throw new ApiError("There's already an account with this email. Log in instead.", "conflict");
  if (m.includes("rate limit") || m.includes("security purposes")) throw new ApiError("Too many tries. Wait a minute and try again.", "validation");
  if (m.includes("expired") || m.includes("invalid") || m.includes("otp")) throw new ApiError("That code has expired or isn't right. Check the latest email we sent.", "validation");
  if (m.includes("password")) throw new ApiError("Use at least 8 characters. A short sentence works well.", "validation");
  throw new ApiError("We couldn't reach PowerProof. Check your connection and try again.");
}

export async function login(email: string, password: string): Promise<Session> {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error) authError(error.message);
  return syncSession();
}

export async function sendLoginLink(email: string): Promise<void> {
  if (!email.includes("@")) throw new ApiError("Enter the email you signed up with.", "validation");
  const { error } = await sb().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: callback("/dashboard") } });
  // Don't reveal whether an account exists: only real failures surface
  if (error && !/signups not allowed|not found/i.test(error.message)) authError(error.message);
}

export async function signInWithGoogle(next = "/dashboard"): Promise<void> {
  const { error } = await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next) } });
  if (error) authError(error.message);
}

export async function signup(name: string, email: string, password?: string): Promise<Session> {
  if (!password || password.length < 8) throw new ApiError("Use at least 8 characters. A short sentence works well.", "validation");
  const clean = email.trim().toLowerCase();
  const { data, error } = await sb().auth.signUp({
    email: clean,
    password,
    options: { data: { full_name: name.trim() }, emailRedirectTo: callback("/onboarding") },
  });
  if (error) authError(error.message);
  // Supabase hides existing accounts by returning a user with no identities
  if (data.user && data.user.identities?.length === 0) throw new ApiError("There's already an account with this email. Log in instead.", "conflict");
  try {
    window.sessionStorage.setItem(PENDING, clean);
  } catch {
    /* private mode: the verify page passes the email instead */
  }
  // With email confirmation on there's no session yet; the code (or link) signs them in
  if (data.session) return syncSession();
  return { name: name.trim(), email: clean, storeId: "", needsVerification: true };
}

export async function verifyEmail(code: string, email?: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new ApiError("Codes are 6 digits. Check the email we sent.", "validation");
  let addr = email;
  try {
    addr ??= window.sessionStorage.getItem(PENDING) ?? undefined;
  } catch {
    /* private mode */
  }
  if (!addr) throw new ApiError("Open the link in the email we sent, or sign up again.", "validation");
  const { error } = await sb().auth.verifyOtp({ email: addr, token: code, type: "email" });
  if (error) authError(error.message);
  await syncSession();
}

export async function resendVerification(email: string): Promise<void> {
  let addr = email;
  try {
    if (!addr.includes("@")) addr = window.sessionStorage.getItem(PENDING) ?? "";
  } catch {
    /* private mode */
  }
  if (!addr.includes("@")) throw new ApiError("Sign up again so we know where to send it.", "validation");
  const { error } = await sb().auth.resend({ type: "signup", email: addr, options: { emailRedirectTo: callback("/onboarding") } });
  if (error) authError(error.message);
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!email.includes("@")) throw new ApiError("Enter a valid email.", "validation");
  const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: callback("/reset-password") });
  if (error && /rate limit|security purposes/i.test(error.message)) authError(error.message);
}

export async function updatePassword(password: string): Promise<void> {
  if (password.length < 8) throw new ApiError("Use at least 8 characters. A short sentence works well.", "validation");
  const { error } = await sb().auth.updateUser({ password });
  if (error) authError(error.message);
}

export async function logout(): Promise<void> {
  await sb().auth.signOut();
  clearSession();
}
