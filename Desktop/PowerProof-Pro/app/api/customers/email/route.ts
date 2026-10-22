import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { mailConfigured, sendMail, storeMessageMail } from "@/lib/server/email";
import { unsubscribeUrl } from "@/lib/server/unsubscribe";
import { siteUrl } from "@/lib/site-url";
import { sbAdmin } from "@/lib/supabase/admin";
import { sbServer } from "@/lib/supabase/server";

/**
 * Email customers from the store. One customer: a direct message (not to anyone who unsubscribed).
 * Several: only buyers who asked for the store's emails at checkout and haven't unsubscribed, up
 * to 1,000 at a time and 3 sends a day. Every email has an unsubscribe link and replies go to the
 * store's support email.
 */
export const dynamic = "force-dynamic";

const body = z.object({
  storeId: z.string().uuid(),
  emails: z.array(z.string().email().max(254)).min(1).max(1000),
  subject: z.string().trim().min(2).max(150),
  body: z.string().trim().min(5).max(10_000),
});

const MAX_BULK_PER_DAY = 3;

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Add a subject and a message." }, { status: 400 });
  const { storeId, subject, body: text } = parsed.data;
  const db = await sbServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, message: "Log in again." }, { status: 401 });
  if (!mailConfigured()) return NextResponse.json({ ok: false, message: "Email isn't connected yet, so nothing was sent." }, { status: 503 });

  // The person's own session decides whether they may (the store's orders area)
  const audience = await db.rpc("customer_audience", { p_store: storeId });
  if (audience.error) return NextResponse.json({ ok: false, message: "You can't email this store's customers." }, { status: 403 });
  const byEmail = new Map((audience.data ?? []).map((a) => [a.email.toLowerCase(), a]));
  const wanted = [...new Set(parsed.data.emails.map((e) => e.toLowerCase()))];
  const bulk = wanted.length > 1;
  const to = wanted.filter((e) => {
    const a = byEmail.get(e);
    return !!a && !a.unsubscribed && (!bulk || a.opted_in);
  });
  if (!to.length) return NextResponse.json({ ok: false, message: bulk ? "None of them asked for your emails, or they unsubscribed." : "This customer unsubscribed from your emails." }, { status: 400 });

  const admin = sbAdmin();
  if (bulk) {
    const { count } = await admin.from("email_sends").select("id", { count: "exact", head: true }).eq("store_id", storeId).gt("recipients", 1).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if ((count ?? 0) >= MAX_BULK_PER_DAY) return NextResponse.json({ ok: false, message: `You can send ${MAX_BULK_PER_DAY} group emails a day. Try again tomorrow.` }, { status: 429 });
  }
  const { data: store } = await admin.from("stores").select("name, slug, support_email").eq("id", storeId).single();
  if (!store) return NextResponse.json({ ok: false, message: "We can't find that store." }, { status: 404 });

  let sent = 0;
  // A few at a time, so a long list doesn't time out or trip the mail provider's limits
  for (let i = 0; i < to.length; i += 5) {
    const batch = to.slice(i, i + 5);
    const results = await Promise.all(
      batch.map((email) =>
        sendMail({ to: email, ...storeMessageMail({ storeName: store.name, subject, body: text, unsubscribeUrl: unsubscribeUrl(storeId, email), storeUrl: `${siteUrl()}/s/${store.slug}`, supportEmail: store.support_email ?? undefined }) }).catch(() => undefined)
      )
    );
    sent += results.filter((r) => r?.sent).length;
  }
  await admin.from("email_sends").insert({ store_id: storeId, subject, recipients: sent, sent_by: auth.user.id });
  if (!sent) return NextResponse.json({ ok: false, message: "The emails couldn't be sent. Try again in a minute." }, { status: 502 });
  return NextResponse.json({ ok: true, sent, skipped: wanted.length - to.length });
}
