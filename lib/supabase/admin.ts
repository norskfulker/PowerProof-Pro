import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SUPABASE_URL } from "./env";

/**
 * Service-role client. Bypasses RLS, so it is only for server code (route handlers, cron) that has
 * already checked who is asking. `server-only` makes any client import fail the build, and
 * tests/unit/security/service-role.test.ts checks the bundle never contains the key.
 */
export function sbAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
