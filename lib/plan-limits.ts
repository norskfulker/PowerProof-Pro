import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { PLAN_LIMITS, type AllPlanLimits } from "./plans";
import { isLive, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/env";

type Row = Database["public"]["Tables"]["plan_limits"]["Row"];

export function limitsFromRows(rows: Row[] | null | undefined): AllPlanLimits {
  const out: AllPlanLimits = { free: { ...PLAN_LIMITS.free }, pro: { ...PLAN_LIMITS.pro } };
  for (const r of rows ?? []) out[r.plan] = { stores: r.max_stores, products: r.max_products, aiCredits: r.ai_credits_monthly, customDomain: r.custom_domain };
  return out;
}

/**
 * Plan limits as the database enforces them (plan_limits is readable by anyone). Works on the
 * server and in the browser; the mock backend gets the demo values.
 */
export async function fetchPlanLimits(): Promise<AllPlanLimits> {
  if (!isLive()) return PLAN_LIMITS;
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from("plan_limits").select("*");
  if (error) throw new Error("plan limits unavailable");
  return limitsFromRows(data);
}
