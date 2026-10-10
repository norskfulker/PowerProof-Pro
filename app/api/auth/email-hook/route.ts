import "server-only";
import { NextResponse } from "next/server";
import { sendHookMails, verifyHook, type HookPayload } from "@/lib/server/auth-email";
import { siteUrl } from "@/lib/server/shop";

/**
 * Supabase Auth's Send Email hook: account emails (sign-up code, login link, password reset,
 * email change, invite) go out through Resend in PowerProof's design. Turn it on in Supabase under
 * Authentication > Hooks > Send Email (HTTPS) with https://<your site>/api/auth/email-hook, and put
 * the secret it shows in SEND_EMAIL_HOOK_SECRET.
 */
export const dynamic = "force-dynamic";

const error = (message: string, status: number) => NextResponse.json({ error: { http_code: status, message } }, { status });

export async function POST(request: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) return error("The email hook isn't set up (SEND_EMAIL_HOOK_SECRET).", 503);
  const raw = await request.text();
  const ok = verifyHook(raw, { id: request.headers.get("webhook-id"), timestamp: request.headers.get("webhook-timestamp"), signature: request.headers.get("webhook-signature") }, secret);
  if (!ok) return error("Bad signature.", 401);
  let payload: HookPayload;
  try {
    payload = JSON.parse(raw) as HookPayload;
  } catch {
    return error("Bad request.", 400);
  }
  try {
    await sendHookMails(payload, siteUrl());
    return NextResponse.json({});
  } catch (e) {
    console.error("[auth-email]", payload.email_data?.email_action_type, e instanceof Error ? e.message : e);
    return error("We couldn't send the email. Try again in a minute.", 500);
  }
}
