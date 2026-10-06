/**
 * Where data comes from. With the Supabase URL and anon key set, `/lib/api` talks to the real
 * backend; without them (unit tests, the design review build) it keeps using the in-browser mock.
 * NEXT_PUBLIC_BACKEND=mock forces the mock even when keys are present.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isLive(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) && process.env.NEXT_PUBLIC_BACKEND !== "mock";
}
