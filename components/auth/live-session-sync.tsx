"use client";

import { useEffect } from "react";
import { getSessionRaw, notifyChange } from "@/lib/mock/db";
import { onProgressSaved } from "@/lib/mock/progress";
import { clearSession, persistProgress, syncSession } from "@/lib/api/live/session";
import { isLive } from "@/lib/supabase/env";
import { sb } from "@/lib/supabase/browser";

/**
 * Keeps the app's cached session in step with Supabase Auth (sign-in in another tab, Google
 * returning through /auth/callback, sign-out, token expiry) and saves getting-started progress
 * to the account. Renders nothing; does nothing on the mock backend.
 */
export function LiveSessionSync() {
  useEffect(() => {
    if (!isLive()) return;
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
      const stale = !cached || cached.email !== session.user.email?.toLowerCase() || !/^[0-9a-f-]{36}$/i.test(cached.storeId);
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
