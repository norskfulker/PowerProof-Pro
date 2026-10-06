import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Server components and route handlers: the anon key plus the visitor's cookies, so RLS sees the
 * same person the browser does. Buyers have no session and get the anon role.
 */
export async function sbServer() {
  const store = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a server component: the proxy refreshes the cookie instead */
        }
      },
    },
  });
}
