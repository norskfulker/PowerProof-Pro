import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sbServer } from "@/lib/supabase/server";

/**
 * Where email links (confirm, login link, password reset) and Google sign-in come back to.
 * Exchanges the one-time code for a session cookie, then continues to `next` (same site only).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const raw = url.searchParams.get("next") ?? "/dashboard";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
  const supabase = await sbServer();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  const to = url.clone();
  to.search = "";
  if (ok) {
    const [path, query] = next.split("?");
    to.pathname = path;
    if (query) to.search = `?${query}`;
  } else {
    to.pathname = "/login";
    to.search = "?error=link";
  }
  return NextResponse.redirect(to);
}
