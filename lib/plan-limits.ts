import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { AllPlanLimits } from "./plans";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/env";

type Row = Database["public"]["Tables"]["plan_limits"]["Row"];

/** Limits exactly as the plan_limits table holds them. Throws if either plan is missing. */
export function limitsFromRows(rows: Row[] | null | undefined): AllPlanLimits {
  const out: Partial<AllPlanLimits> = {};
  for (const r of rows ?? []) out[r.plan] = { stores: r.max_stores, products: r.max_products, pages: r.max_pages ?? null, aiCredits: r.ai_credits_monthly, customDomain: r.custom_domain };
  if (!out.free || !out.pro) throw new Error("plan limits unavailable");
  return out as AllPlanLimits;
}

/**
 * Plan limits as the database enforces them (plan_limits is readable by anyone). Works on the
 * server and in the browser.
 */
export async function fetchPlanLimits(): Promise<AllPlanLimits> {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from("plan_limits").select("*");
  if (error) throw new Error("plan limits unavailable");
  return limitsFromRows(data);
}
