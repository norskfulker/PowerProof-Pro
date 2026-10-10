/**
 * Where data comes from: Supabase, always. There is no fallback backend: if these are missing the
 * app says so (see `missingEnv`) instead of showing anything made up.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function missingEnv(): string[] {
  return [SUPABASE_URL ? "" : "NEXT_PUBLIC_SUPABASE_URL", SUPABASE_ANON_KEY ? "" : "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(Boolean);
}
