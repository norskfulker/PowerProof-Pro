import { createHmac, timingSafeEqual } from "node:crypto";
import { authMail, sendMail, type AuthMailKind, type Mail } from "./email";

/**
 * Supabase Auth's "Send Email" hook: Supabase hands us each account email (sign-up code, login
 * link, password reset, email change, invite) and we send it through Resend with our own design.
 * Turned on in the Supabase dashboard (Authentication > Hooks > Send Email, HTTPS, pointing at
 * /api/auth/email-hook) with its secret in SEND_EMAIL_HOOK_SECRET.
 */

export interface HookPayload {
  user: { email?: string; new_email?: string };
  email_data: {
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
  };
}

/** Checks a Standard Webhooks signature (what Supabase signs hooks with). Rejects anything older than 5 minutes. */
export function verifyHook(raw: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, secret: string, now = Date.now()): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest();
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** What /auth/callback passes to verifyOtp for each kind of link */
const LINK_TYPE: Partial<Record<AuthMailKind, string>> = { signup: "email", magiclink: "email", recovery: "recovery", invite: "invite", email_change: "email_change" };

/** The link in the email: straight to our /auth/callback (which signs them in), keeping where they were headed */
export function callbackLink(kind: AuthMailKind, tokenHash: string | undefined, redirectTo: string | undefined, site: string): string | undefined {
  const type = LINK_TYPE[kind];
  if (!type || !tokenHash) return undefined;
  let url: URL;
  try {
    url = new URL(redirectTo || "", site);
  } catch {
    url = new URL("/auth/callback", site);
  }
  // Only our own callback; anything else (a bare site address) goes through it to the dashboard
  if (url.origin !== new URL(site).origin || url.pathname !== "/auth/callback") url = new URL(`/auth/callback?next=${encodeURIComponent(kind === "recovery" ? "/reset-password" : "/dashboard")}`, site);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  return url.toString();
}

/** One account email (two for a secure email change), ready to send */
export function hookMails(p: HookPayload, site: string): Mail[] {
  const d = p.email_data;
  const action = d.email_action_type === "email" ? "magiclink" : d.email_action_type;
  const email = p.user.email ?? "";

  if (action === "email_change") {
    // Supabase's names are reversed: token_hash_new goes with the CURRENT address, token_hash with the new one
    const out: Mail[] = [];
    const newEmail = p.user.new_email;
    if (newEmail) {
      // With secure change off there's one code (in `token`), for the new address
      const code = d.token_new || d.token;
      out.push({ to: newEmail, ...authMail({ kind: "email_change", email: newEmail, code, url: callbackLink("email_change", d.token_hash, d.redirect_to, site) }) });
    }
    if (d.token_new && d.token_hash_new && email) out.push({ to: email, ...authMail({ kind: "email_change", email, code: d.token, url: callbackLink("email_change", d.token_hash_new, d.redirect_to, site) }) });
    return out;
  }

  if (action in AUTH_KINDS) {
    const kind = action as AuthMailKind;
    return [{ to: email, ...authMail({ kind, email, code: d.token, url: callbackLink(kind, d.token_hash, d.redirect_to, site) }) }];
  }

  // Security notices (password or email changed, sign-in methods, two-step login)
  const notice = NOTICES[action];
  if (notice && email) return [{ to: email, subject: notice, html: noticeHtml(notice), text: `${notice}\n\nIf this wasn't you, reset your password straight away and reply to this email.` }];
  return [];
}

const AUTH_KINDS: Record<AuthMailKind, true> = { signup: true, magiclink: true, recovery: true, email_change: true, invite: true, reauthentication: true };

const NOTICES: Record<string, string> = {
  password_changed_notification: "Your PowerProof password was changed",
  email_changed_notification: "The email on your PowerProof account was changed",
  phone_changed_notification: "The phone number on your PowerProof account was changed",
  identity_linked_notification: "A new sign-in method was added to your PowerProof account",
  identity_unlinked_notification: "A sign-in method was removed from your PowerProof account",
  mfa_factor_enrolled_notification: "Two-step login was turned on for your PowerProof account",
  mfa_factor_unenrolled_notification: "Two-step login was turned off for your PowerProof account",
};

const noticeHtml = (title: string) =>
  `<!doctype html><html><body style="margin:0;background:#f5f6f4;font-family:system-ui,sans-serif;color:#0c1f1b"><div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border:1px solid #dfe5e1;border-radius:12px;padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${title}</h1><p>This is a heads-up that it just happened. If it was you, there's nothing to do.</p><p>If it wasn't you, reset your password straight away and reply to this email.</p></div></div></body></html>`;

/** Sends what the hook asked for. Throws when Resend isn't set up or refuses, so Supabase shows the sign-up an error instead of a silent nothing. */
export async function sendHookMails(p: HookPayload, site: string, env: Record<string, string | undefined> = process.env) {
  const mails = hookMails(p, site);
  for (const m of mails) {
    const r = await sendMail(m, env);
    if (!r.sent) throw new Error(r.reason === "not_configured" ? "Email isn't connected (RESEND_API_KEY and MAIL_FROM)." : "The email service didn't accept the message.");
  }
  return mails.length;
}
