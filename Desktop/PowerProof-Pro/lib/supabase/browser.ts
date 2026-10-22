import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";
import { missingEnv, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** The browser client (anon key + the creator's session cookie). RLS decides what it can see. */
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function sb() {
  if (!client) {
    const missing = missingEnv();
    if (missing.length) throw new Error(`Supabase isn't configured: set ${missing.join(" and ")}.`);
  }
  if (!client) client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export type Sb = ReturnType<typeof sb>;
