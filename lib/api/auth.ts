import type { Session } from "../types";
import * as live from "./live/auth";
import { getSessionRaw } from "./live/local";

/** Creator sign-in, sign-up and account recovery, all through Supabase Auth. */

export function getSession(): Session | null {
  return getSessionRaw();
}

export const login = live.login;
export const sendLoginLink = live.sendLoginLink;
/** Google sign-in. Leaves the page for Google and comes back through /auth/callback. */
export const signInWithGoogle = live.signInWithGoogle;
export const signup = live.signup;
export const verifyEmail = live.verifyEmail;
export const resendVerification = live.resendVerification;
export const requestPasswordReset = live.requestPasswordReset;
/** Sets a new password after following a reset link (the link signs the creator in). */
export const updatePassword = live.updatePassword;
export const logout = live.logout;
