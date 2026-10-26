import { inWindow, nextWindowOpen } from "@/lib/agents/time";
import type { InstanceStatus } from "@/lib/agents/define";
import type { ActionItemInput, Channel, OutboundMessage, SendOutcome } from "../runtime/types";
import { reminderEmailHtml } from "./email-html";

/**
 * The one path every agent message takes:
 * consent → agent running → channel on → valid recipient → sending window → (in the database, in one
 * transaction) idempotency, opt-out, per-contact cap, daily cap and the credit charge → send → log.
 * Email goes out through Resend; WhatsApp becomes a one-tap item in the owner's queue; SMS stays
 * off until a provider and DLT registration exist. Every message carries a way to opt out.
 */

export type ReserveResult = { result: "reserved"; outboxId: string } | { result: "duplicate"; outboxId: string; status: string } | { result: "frequency_cap" | "daily_cap" | "no_credits" | "opted_out" };

export interface PipelineDeps {
  now: Date;
  dryRun: boolean;
  instance: { status: InstanceStatus; consentAt: string | null; sendWindow: string; channelsOn: readonly Channel[] };
  /** True when sending is switched off (globally, for this agent, or this instance) */
  stopped(): Promise<boolean>;
  limits: { capMessages: number; capDays: number; dailyCap: number };
  creditCost(reason: string): number;
  reserve(o: { channel: Channel; to: string; contactKey: string; subject: string | null; body: string; idempotencyKey: string; credits: number; creditReason: string; limits: PipelineDeps["limits"] }): Promise<ReserveResult>;
  deliverEmail(o: { to: string; subject: string; text: string; html: string; replyTo?: string }): Promise<{ ok: true; id?: string } | { ok: false; error: string }>;
  /** Records the result; "failed" gives the credits back */
  finish(outboxId: string, o: { status: "sent" | "queued" | "failed"; providerId?: string; error?: string }): Promise<void>;
  enqueueAction(item: ActionItemInput): Promise<void>;
  /** The unsubscribe link for one message (signed, names no address) */
  optOutUrl(outboxId: string): string;
  /** Where a reply to this message goes when inbound email is set up (the reply is then read and logged) */
  replyAddress?(outboxId: string): string | undefined;
  smsEnabled: boolean;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

export function validRecipient(channel: Channel, to: string): boolean {
  return channel === "email" ? EMAIL_RE.test(to) : E164_RE.test(to);
}

export function emailWithOptOut(body: string, optOutUrl: string, from: string): { text: string; html: string } {
  const text = `${body}\n\n—\n${from}\nDon't want these reminders? Unsubscribe: ${optOutUrl}`;
  const html = reminderEmailHtml({ brand: from, body, unsubscribeUrl: optOutUrl });
  return { text, html };
}

export const WHATSAPP_OPT_OUT = "Reply STOP to opt out.";

export function whatsappLink(phoneE164: string, body: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, "")}?text=${encodeURIComponent(`${body}\n\n${WHATSAPP_OPT_OUT}`)}`;
}

export async function sendThroughPipeline(deps: PipelineDeps, msg: OutboundMessage, from: string): Promise<SendOutcome> {
  if (!deps.dryRun) {
    if (!deps.instance.consentAt) return { status: "skipped", reason: "no_consent" };
    if (deps.instance.status !== "trial" && deps.instance.status !== "active") return { status: "skipped", reason: "not_active" };
    if (await deps.stopped()) return { status: "skipped", reason: "kill_switch" };
  }
  if (!deps.instance.channelsOn.includes(msg.channel) || (msg.channel === "sms" && !deps.smsEnabled)) return { status: "skipped", reason: "channel_off" };
  if (!validRecipient(msg.channel, msg.to)) return { status: "skipped", reason: "invalid_recipient" };
  // Email sends on its own, so it waits for the window; WhatsApp waits for the owner's tap instead
  if (msg.channel !== "whatsapp" && !inWindow(deps.instance.sendWindow, deps.now)) {
    return { status: "skipped", reason: "outside_window", retryAt: nextWindowOpen(deps.instance.sendWindow, deps.now).toISOString() };
  }
  if (deps.dryRun) return { status: "dry_run" };

  const r = await deps.reserve({
    channel: msg.channel,
    to: msg.to,
    contactKey: msg.contactKey,
    subject: msg.subject ?? null,
    body: msg.body,
    idempotencyKey: msg.idempotencyKey,
    credits: deps.creditCost(msg.creditReason),
    creditReason: msg.creditReason,
    limits: deps.limits,
  });
  if (r.result === "duplicate") return { status: "skipped", reason: "duplicate" };
  if (r.result !== "reserved") return { status: "skipped", reason: r.result };

  if (msg.channel === "whatsapp") {
    await deps.enqueueAction({
      kind: "whatsapp_send",
      title: msg.title ?? `WhatsApp ${msg.toName ?? "customer"}`,
      body: msg.body,
      payload: { url: whatsappLink(msg.to, msg.body), outboxId: r.outboxId, toName: msg.toName ?? null },
      ref: msg.ref,
      idempotencyKey: `action:${msg.idempotencyKey}`,
    });
    await deps.finish(r.outboxId, { status: "queued" });
    return { status: "queued", outboxId: r.outboxId };
  }

  if (msg.channel === "email") {
    const { text, html } = emailWithOptOut(msg.body, deps.optOutUrl(r.outboxId), from);
    const sent = await deps.deliverEmail({ to: msg.to, subject: msg.subject || from, text, html, replyTo: deps.replyAddress?.(r.outboxId) ?? msg.replyTo });
    if (!sent.ok) {
      await deps.finish(r.outboxId, { status: "failed", error: sent.error });
      return { status: "failed", error: sent.error };
    }
    await deps.finish(r.outboxId, { status: "sent", providerId: sent.id });
    return { status: "sent", outboxId: r.outboxId };
  }

  // SMS: the provider adapter is a stub until a provider and DLT are in place
  await deps.finish(r.outboxId, { status: "failed", error: "SMS isn't set up yet." });
  return { status: "failed", error: "SMS isn't set up yet." };
}
