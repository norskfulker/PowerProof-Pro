import "server-only";
import { AGENT_CODE } from "@/agents/server";
import { esc, mailConfigured } from "@/lib/server/email";
import { allow } from "@/lib/server/limit";
import { AgentError } from "./access";
import { agentsAdmin, storeDb } from "./db";
import { sendAgentMail } from "./mail";
import { businessName, loadStoreInfo } from "./ports";

/**
 * "Send me a test email": the owner gets the exact email a customer would, built from their own
 * data, at their own address. Never sent to a customer, no credits, 5 an hour per person.
 */
export async function sendTestEmail(o: { instanceId: string; storeId: string; agentId: string; user: { id: string; email: string } }): Promise<{ to: string }> {
  const hook = AGENT_CODE[o.agentId]?.testMessage;
  if (!hook) throw new AgentError("This agent has no test email.", 404);
  if (!o.user.email) throw new AgentError("Your account has no email address to send the test to.");
  if (!mailConfigured()) throw new AgentError("Email isn't set up on this site yet (RESEND_API_KEY and MAIL_FROM).", 503);
  if (!allow(`agent-test-email:${o.user.id}`, 5, 3_600_000)) throw new AgentError("That's 5 test emails this hour. Try again later.", 429);

  const { data: inst } = await agentsAdmin().from("agent_instances").select("settings").eq("id", o.instanceId).maybeSingle();
  const store = await loadStoreInfo(o.storeId);
  const msg = await hook(storeDb(o.storeId), { settings: (inst?.settings as Record<string, unknown>) ?? {}, businessName: businessName(store), now: new Date() });
  if ("missing" in msg) throw new AgentError(msg.missing, 409);

  const note = `This is a test, sent only to you. It's ${msg.about}. Customers also get an unsubscribe link at the bottom.`;
  const text = `${note}\n\n— — —\n\n${msg.body}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0B100E"><p style="background:#FFF4D6;border-radius:8px;padding:10px 12px;font-size:13px;margin:0 0 20px">${esc(note)}</p>${esc(msg.body).replace(/\n/g, "<br>")}</div>`;
  const sent = await sendAgentMail({ displayName: businessName(store), to: o.user.email, subject: `[Test] ${msg.subject}`, text, html, replyTo: store.support_email ?? undefined });
  if (!sent.sent) throw new AgentError(sent.reason === "not_configured" ? "Email isn't set up on this site yet (RESEND_API_KEY and MAIL_FROM)." : `The email service didn't accept it${sent.detail ? `: ${sent.detail}` : "."}`, 502);
  return { to: o.user.email };
}
