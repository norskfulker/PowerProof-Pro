import "server-only";
import { NextResponse } from "next/server";
import { verifyHook } from "@/lib/server/auth-email";
import { agentsAdmin } from "@/lib/server/agents/db";
import { sendAgentMail } from "@/lib/server/agents/mail";
import { businessName, loadStoreInfo, ownerEmail } from "@/lib/server/agents/ports";
import { readReplyAddress, recordReply, replyText } from "@/lib/server/agents/replies";
import { INTENT_LABEL } from "@/lib/agents/replies";
import { siteUrl } from "@/lib/site-url";

/**
 * Customers' email replies to agent messages (Resend inbound, event `email.received`). Each
 * reminder's Reply-To is a signed address, reply+<message>.<signature>@AGENT_REPLY_DOMAIN, so a
 * reply names the message it answers and can't be forged. The webhook carries metadata only; the
 * words are read from Resend's Received emails API. The reply is recorded and its rule applied, and
 * the store gets a copy so nothing a customer writes is lost.
 *
 * Setup: an MX record for AGENT_REPLY_DOMAIN pointing at Resend (Resend › Receiving), a webhook for
 * `email.received` to https://<site>/api/webhooks/agent-replies, and its signing secret in
 * RESEND_INBOUND_SECRET.
 */
export const dynamic = "force-dynamic";

type Received = { from?: string; to?: string[]; subject?: string; text?: string | null; html?: string | null; message_id?: string };

const htmlToText = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');

export async function POST(request: Request) {
  const secret = process.env.RESEND_INBOUND_SECRET;
  if (!secret || !process.env.RESEND_API_KEY) return NextResponse.json({ ok: false, message: "Inbound replies aren't set up." }, { status: 503 });
  const raw = await request.text();
  const h = (a: string, b: string) => request.headers.get(a) ?? request.headers.get(b);
  if (!verifyHook(raw, { id: h("svix-id", "webhook-id"), timestamp: h("svix-timestamp", "webhook-timestamp"), signature: h("svix-signature", "webhook-signature") }, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let event: { type?: string; data?: { email_id?: string; to?: string[] } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data?.email_id) return NextResponse.json({ ok: true, ignored: true });

  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(event.data.email_id)}`, { headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(10000) }).catch(() => null);
  // Resend retries a failed delivery, so a fetch that didn't work is worth a retry
  if (!res?.ok) return NextResponse.json({ ok: false, message: "Couldn't read the email." }, { status: 502 });
  const mail = (await res.json()) as Received;

  const outboxId = [...(mail.to ?? []), ...(event.data.to ?? [])].map((a) => readReplyAddress(a.replace(/^.*</, "").replace(/>.*$/, ""))).find(Boolean);
  if (!outboxId) return NextResponse.json({ ok: true, ignored: "not a reply to an agent message" });
  const text = mail.text ?? (mail.html ? htmlToText(mail.html) : "");

  try {
    const r = await recordReply({ outboxId, source: "inbound", text, providerMessageId: mail.message_id ?? event.data.email_id });
    if (!r.duplicate) await forwardToStore(outboxId, mail, replyText(text), INTENT_LABEL[r.intent]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[agent-replies]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** The store's copy: who wrote (their own address), what they said, and where to see it */
async function forwardToStore(outboxId: string, mail: Received, excerpt: string, meaning: string) {
  const sb = agentsAdmin();
  const { data: msg } = await sb.from("agent_messages_outbox").select("store_id, instance_id").eq("id", outboxId).maybeSingle();
  if (!msg) return;
  const store = await loadStoreInfo(String(msg.store_id));
  const to = store.support_email || (await ownerEmail(store.owner_id));
  if (!to) return;
  const from = mail.from ?? "A customer";
  const url = `${siteUrl()}/agents/my/${msg.instance_id}?tab=replies`;
  const text = `${from} replied (${meaning.toLowerCase()}):\n\n${excerpt || "(no text)"}\n\nSee it and what the agent did: ${url}`;
  const html = `<p><strong>${escapeHtml(from)}</strong> replied (${escapeHtml(meaning.toLowerCase())}):</p><blockquote style="margin:0;padding:8px 12px;border-left:3px solid #ccc;white-space:pre-wrap">${escapeHtml(excerpt || "(no text)")}</blockquote><p><a href="${url}">See it and what the agent did</a></p>`;
  await sendAgentMail({ displayName: businessName(store), to, subject: `Reply: ${mail.subject ?? "your reminder"}`.slice(0, 150), text, html, replyTo: mail.from });
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
