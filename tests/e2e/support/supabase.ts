import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../lib/database.types";
import { need, optional } from "./env";

export type Who = "A" | "B";
export type Client = SupabaseClient<Database>;

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export const creds = (who: Who) => ({ email: need(`TEST_CREATOR_${who}_EMAIL`), password: need(`TEST_CREATOR_${who}_PASSWORD`) });

/** A client signed in as one of the two test creators. Row level security applies, as in the app. */
export async function signInAs(who: Who): Promise<{ client: Client; userId: string; email: string }> {
  const client = createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), need("NEXT_PUBLIC_SUPABASE_ANON_KEY"), options);
  const c = creds(who);
  const { data, error } = await client.auth.signInWithPassword(c);
  if (error || !data.user) throw new Error(`Couldn't sign in as test creator ${who}: ${error?.message ?? "no user"}`);
  return { client, userId: data.user.id, email: c.email };
}

/**
 * Optional, test-only: with the service-role key the setup can put creator A on Pro for the run
 * (so more than one product can exist) and add the one thing creators can't create themselves,
 * a paid order with a review. Without it those tests are skipped, with that stated.
 */
export function serviceClient(): Client | null {
  const key = optional("SUPABASE_SERVICE_ROLE_KEY");
  return key ? createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), key, options) : null;
}
