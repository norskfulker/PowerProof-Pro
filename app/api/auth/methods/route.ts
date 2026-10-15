import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allow, clientKey } from "@/lib/server/limit";
import { sbAdmin } from "@/lib/supabase/admin";

/**
 * After an email login fails (or sign-up finds the email taken): does this email belong to an
 * account that signs in with Google and has no password yet? Then the login page can say so and
 * offer to add a password to that same account. Nothing else is revealed, and it is rate limited
 * per visitor and per email.
 */
export const dynamic = "force-dynamic";

const no = () => NextResponse.json({ ok: true, google: false }, { headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const p = z.object({ email: z.string().trim().email().max(254) }).safeParse(await request.json().catch(() => null));
  if (!p.success) return no();
  const email = p.data.email.toLowerCase();
  if (!allow(`auth-methods:${clientKey(request)}`, 10, 10 * 60_000) || !allow(`auth-methods:${email}`, 6, 10 * 60_000)) return no();
  const { data, error } = await sbAdmin().rpc("auth_methods", { p_email: email });
  const row = data?.[0];
  if (error || !row?.out_exists) return no();
  return NextResponse.json({ ok: true, google: row.out_google && !row.out_password }, { headers: { "cache-control": "no-store" } });
}
