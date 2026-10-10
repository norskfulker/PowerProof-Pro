"use client";

import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase/browser";

export type Account = { status: "unknown" } | { status: "out" } | { status: "in"; name: string; email: string };

/**
 * Who is signed in, for public pages (the marketing site) that are rendered the same for everyone.
 * "unknown" until the browser has read the session cookie, so nothing flips from "Log in" to the
 * profile after the first paint. Follows sign-in and sign-out in other tabs.
 */
export function useAccount(): Account {
  const [account, setAccount] = useState<Account>({ status: "unknown" });
  useEffect(() => {
    const client = sb();
    const apply = (user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) => {
      if (!user) return setAccount({ status: "out" });
      const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
      const email = user.email ?? "";
      setAccount({ status: "in", email, name: meta.full_name || meta.name || email.split("@")[0] });
    };
    let alive = true;
    client.auth.getSession().then(({ data }) => alive && apply(data.session?.user), () => alive && setAccount({ status: "out" }));
    const { data } = client.auth.onAuthStateChange((_event, session) => alive && apply(session?.user));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return account;
}
