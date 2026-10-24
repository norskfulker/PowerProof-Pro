import "server-only";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { sendMail, type MailResult } from "@/lib/server/email";
import { agentEnv } from "./mail-from";

/**
 * Agent email goes out through the app's own Resend helper with the address the founder chose
 * (MAIL_FROM, amaze@powerproof.app), shown as "<Store> via PowerProof" so customers know who it's
 * from; replies go to the store's support email.
 */

export function sendAgentMail(o: { displayName: string; to: string; subject: string; text: string; html: string; replyTo?: string }): Promise<MailResult> {
  return sendMail({ to: o.to, subject: o.subject, text: o.text, html: o.html, replyTo: o.replyTo }, agentEnv(o.displayName));
}

export async function renderEmail(el: ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { html, text };
}
