"use client";

import { useEffect } from "react";
import { onProgressSaved } from "@/lib/api/live/flags";
import { getSessionRaw, notifyChange } from "@/lib/api/live/local";
import { clearSession, persistProgress, syncSession } from "@/lib/api/live/session";
import { sb } from "@/lib/supabase/browser";

/**
 * Keeps the app's cached session in step with Supabase Auth (sign-in in another tab, Google
 * returning through /auth/callback, sign-out, token expiry) and saves getting-started progress
 * to the account. Renders nothing.
 */
export function LiveSessionSync() {
  useEffect(() => {
    onProgressSaved((flags) => void persistProgress(flags));
    const { data } = sb().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        if (getSessionRaw()) {
          clearSession();
          notifyChange();
        }
        return;
      }
      const cached = getSessionRaw();
      const stale = !cached || cached.email !== session.user.email?.toLowerCase() || (!cached.storeId && event === "SIGNED_IN");
      if (stale || event === "USER_UPDATED") {
        // Supabase asks not to await other auth calls inside this callback
        setTimeout(() => {
          syncSession().then(notifyChange, () => undefined);
        }, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
