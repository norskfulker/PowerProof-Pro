import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { SUPABASE_URL } from "./env";

/**
 * Service-role client. Bypasses RLS, so it is only for server code (route handlers, cron) that has
 * already checked who is asking. `server-only` makes any client import fail the build.
 */
/** Whether the key is set (for the status page); the key itself never leaves this file. */
export const serviceKeyConfigured = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY;
/** The setting's name, for the status page to tell staff what to set (the server sends it; no browser file holds it). */
export const serviceKeyName = () => "SUPABASE_SERVICE_ROLE_KEY";

export function sbAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
