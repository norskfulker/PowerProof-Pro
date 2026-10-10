/**
 * Email through Resend, over HTTPS. RESEND_API_KEY turns it on and MAIL_FROM names the sender
 * (for example "PowerProof <orders@yourdomain.com>", on a domain verified with Resend). With no key
 * nothing is sent and the caller is told, so screens never claim an email went out when it didn't.
 */
export type MailResult = { sent: true } | { sent: false; reason: "not_configured" | "failed" };

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export const mailConfigured = (env: Record<string, string | undefined> = process.env) => !!env.RESEND_API_KEY && !!env.MAIL_FROM;

export async function sendMail(mail: Mail, env: Record<string, string | undefined> = process.env): Promise<MailResult> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return { sent: false, reason: "not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, reply_to: mail.replyTo }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[mail] Resend answered ${res.status}`);
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[mail] couldn't reach Resend", e instanceof Error ? e.message : e);
    return { sent: false, reason: "failed" };
  }
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const shell = (title: string, body: string, footer = "Sent by PowerProof on behalf of the store.") =>
  `<!doctype html><html><body style="margin:0;background:#f5f6f4;font-family:system-ui,sans-serif;color:#0c1f1b"><div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border:1px solid #dfe5e1;border-radius:12px;padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${body}</div><p style="font-size:12px;color:#6b7b75;text-align:center">${esc(footer)}</p></div></body></html>`;

/** Footer for emails PowerProof sends to its own creators (not on a store's behalf) */
const OWN = "PowerProof · You're getting this because you have a PowerProof account.";
const muted = (t: string) => `<p style="font-size:13px;color:#6b7b75">${t}</p>`;
const table = (rows: { title: string; amount: string }[], total?: { label: string; amount: string }) =>
  `<table style="width:100%;border-collapse:collapse;border-top:1px solid #dfe5e1;border-bottom:1px solid #dfe5e1">${rows.map((l) => `<tr><td style="padding:6px 0">${esc(l.title)}</td><td style="padding:6px 0;text-align:right">${esc(l.amount)}</td></tr>`).join("")}${total ? `<tr><td style="padding:8px 0;font-weight:700">${esc(total.label)}</td><td style="padding:8px 0;text-align:right;font-weight:700">${esc(total.amount)}</td></tr>` : ""}</table>`;

const button = (href: string, label: string) => `<p style="margin:20px 0"><a href="${esc(href)}" style="background:#0f3d33;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;font-weight:600">${esc(label)}</a></p>`;

export interface ReceiptInput {
  storeName: string;
  buyerName: string;
  ref: string;
  lines: { title: string; amount: string }[];
  total: string;
  /** The order page: files to download, or where the parcel is */
  downloadUrl: string;
  invoiceUrl?: string;
  supportEmail?: string;
  /** Shipping and COD charges, as lines under the products */
  charges?: { title: string; amount: string }[];
  /** Where it's going, one line */
  shipTo?: string;
  /** Placed for cash on delivery: nothing paid yet */
  cod?: boolean;
  /** Something to download */
  files?: boolean;
}

export function receiptMail(o: ReceiptInput): Omit<Mail, "to"> {
  const files = o.files ?? true;
  const row = (l: { title: string; amount: string }) => `<tr><td style="padding:6px 0">${esc(l.title)}</td><td style="padding:6px 0;text-align:right">${esc(l.amount)}</td></tr>`;
  const rows = [...o.lines, ...(o.charges ?? [])].map(row).join("");
  const intro = o.cod
    ? `<p>Your order is placed. You'll pay <strong>${esc(o.total)}</strong> in cash when it arrives. Order <strong>${esc(o.ref)}</strong> from ${esc(o.storeName)}:</p>`
    : `<p>Your payment went through. Order <strong>${esc(o.ref)}</strong> from ${esc(o.storeName)}:</p>`;
  const ship = o.shipTo ? `<p style="font-size:14px"><strong>Shipping to:</strong> ${esc(o.shipTo)}<br>We'll email you when it's on its way.</p>` : "";
  return {
    subject: o.cod ? `Order placed: ${o.storeName} (${o.ref})` : `Your order from ${o.storeName} (${o.ref})`,
    replyTo: o.supportEmail,
    html: shell(
      `Thanks, ${o.buyerName.split(" ")[0]}!`,
      `${intro}<table style="width:100%;border-collapse:collapse;border-top:1px solid #dfe5e1;border-bottom:1px solid #dfe5e1">${rows}<tr><td style="padding:8px 0;font-weight:700">${o.cod ? "To pay on delivery" : "Total"}</td><td style="padding:8px 0;text-align:right;font-weight:700">${esc(o.total)}</td></tr></table>${ship}${button(o.downloadUrl, files ? "Get your files" : "View your order")}${o.invoiceUrl && !o.cod ? `<p style="font-size:14px"><a href="${esc(o.invoiceUrl)}">View your invoice</a></p>` : ""}<p style="font-size:13px;color:#6b7b75">${files ? "The link works for 30 days. " : ""}Lost it? Look your order up again with this email address and your order number.</p>`
    ),
    text: `Thanks, ${o.buyerName}!\n\n${o.cod ? `Order placed: you'll pay ${o.total} in cash on delivery.` : "Your payment went through."}\nOrder ${o.ref} from ${o.storeName}\n${[...o.lines, ...(o.charges ?? [])].map((l) => `${l.title}  ${l.amount}`).join("\n")}\nTotal ${o.total}\n${o.shipTo ? `\nShipping to: ${o.shipTo}\n` : ""}\n${files ? "Your files" : "Your order"}: ${o.downloadUrl}\n${o.invoiceUrl && !o.cod ? `Invoice: ${o.invoiceUrl}\n` : ""}`,
  };
}

/** The parcel is on its way (or has arrived) */
export function shippedMail(o: { storeName: string; buyerName: string; ref: string; delivered?: boolean; carrier?: string; number?: string; trackUrl?: string; orderUrl: string; supportEmail?: string; cod?: string }): Omit<Mail, "to"> {
  const track = [o.carrier, o.number].filter(Boolean).join(" · ");
  const title = o.delivered ? "Your order has arrived" : "Your order is on its way";
  return {
    subject: `${o.delivered ? "Delivered" : "Shipped"}: your ${o.storeName} order (${o.ref})`,
    replyTo: o.supportEmail,
    html: shell(
      title,
      `<p>Hi ${esc(o.buyerName.split(" ")[0])}, ${o.delivered ? `order <strong>${esc(o.ref)}</strong> from ${esc(o.storeName)} has been delivered.` : `${esc(o.storeName)} has sent order <strong>${esc(o.ref)}</strong>.`}</p>${track ? `<p style="font-size:14px"><strong>Tracking:</strong> ${esc(track)}</p>` : ""}${o.cod && !o.delivered ? `<p style="font-size:14px">Keep <strong>${esc(o.cod)}</strong> ready in cash for the courier.</p>` : ""}${o.trackUrl && !o.delivered ? button(o.trackUrl, "Track your parcel") : button(o.orderUrl, "View your order")}`
    ),
    text: `${title}\n\nOrder ${o.ref} from ${o.storeName}.\n${track ? `Tracking: ${track}\n` : ""}${o.cod && !o.delivered ? `Keep ${o.cod} ready in cash for the courier.\n` : ""}${o.trackUrl ? `Track it: ${o.trackUrl}\n` : ""}Your order: ${o.orderUrl}`,
  };
}

/* Account emails (Supabase Auth hands these to /api/auth/email-hook) ------------------------ */

export type AuthMailKind = "signup" | "magiclink" | "recovery" | "email_change" | "invite" | "reauthentication";

const AUTH_COPY: Record<AuthMailKind, { subject: string; title: string; intro: string; cta: string }> = {
  signup: { subject: "Confirm your email for PowerProof", title: "Confirm your email", intro: "Welcome to PowerProof. Enter this code on the sign-up screen, or tap the button, to confirm it's you.", cta: "Confirm email" },
  magiclink: { subject: "Your PowerProof login link", title: "Here's your login link", intro: "Tap below and you're in. No password needed.", cta: "Log in to PowerProof" },
  recovery: { subject: "Reset your PowerProof password", title: "Set a new password", intro: "Tap below to choose a new password.", cta: "Reset password" },
  email_change: { subject: "Confirm your new email for PowerProof", title: "Confirm your new email", intro: "You asked to change the email on your PowerProof account to this address. Confirm it to finish.", cta: "Confirm new email" },
  invite: { subject: "You're invited to PowerProof", title: "You're invited", intro: "You've been added to a team on PowerProof. Accept to set up your login.", cta: "Accept invite" },
  reauthentication: { subject: "Your PowerProof security code", title: "Confirm it's you", intro: "Enter this code to finish what you started.", cta: "" },
};

/** Sign-up confirmation, login link, password reset, email change and invite: a 6-digit code and a link that do the same */
export function authMail(o: { kind: AuthMailKind; email: string; url?: string; code?: string }): Omit<Mail, "to"> {
  const c = AUTH_COPY[o.kind];
  const code = o.code ? `<p style="margin:16px 0;font-family:'IBM Plex Mono',monospace;font-size:28px;letter-spacing:0.3em;font-weight:700">${esc(o.code)}</p>` : "";
  return {
    subject: c.subject,
    html: shell(
      c.title,
      `<p>${esc(c.intro)}</p>${code}${o.url && c.cta ? button(o.url, c.cta) : ""}${muted(`It works once and expires soon. Didn't ask for this? Ignore this email; nothing changes without it. Sent to ${esc(o.email)}.`)}`,
      OWN
    ),
    text: `${c.title}\n\n${c.intro}\n${o.code ? `\nCode: ${o.code}\n` : ""}${o.url && c.cta ? `\n${c.cta}: ${o.url}\n` : ""}\nIt works once and expires soon. Didn't ask for this? Ignore this email.`,
  };
}

/* Buyer: the payment didn't go through --------------------------------------------------- */

export function paymentFailedMail(o: { storeName: string; buyerName: string; ref: string; total: string; retryUrl: string; reason?: string; supportEmail?: string }): Omit<Mail, "to"> {
  return {
    subject: `Your payment to ${o.storeName} didn't go through (${o.ref})`,
    replyTo: o.supportEmail,
    html: shell(
      "Your payment didn't go through",
      `<p>Hi ${esc(o.buyerName.split(" ")[0])}, your payment of <strong>${esc(o.total)}</strong> for order <strong>${esc(o.ref)}</strong> from ${esc(o.storeName)} didn't complete${o.reason ? `: ${esc(o.reason)}` : "."}</p><p>No money was taken. If your bank shows a charge, it's a hold that's released on its own, usually within 5 to 7 working days.</p>${button(o.retryUrl, "Try again")}${muted("If it happens again, try a different card or UPI app.")}`
    ),
    text: `Your payment didn't go through\n\nOrder ${o.ref} from ${o.storeName}, ${o.total}${o.reason ? `: ${o.reason}` : ""}.\nNo money was taken. Any hold your bank shows is released on its own.\n\nTry again: ${o.retryUrl}`,
  };
}

/* Buyer: the order was refunded ---------------------------------------------------------- */

export function refundMail(o: { storeName: string; buyerName: string; ref: string; amount: string; cash?: boolean; orderUrl: string; supportEmail?: string }): Omit<Mail, "to"> {
  const when = o.cash ? `${o.storeName} will hand the money back to you directly.` : "It goes back to the card or account you paid with. Banks usually show it within 5 to 7 working days.";
  return {
    subject: `Refund for your ${o.storeName} order (${o.ref})`,
    replyTo: o.supportEmail,
    html: shell(
      "Your refund is on its way",
      `<p>Hi ${esc(o.buyerName.split(" ")[0])}, ${esc(o.storeName)} has refunded <strong>${esc(o.amount)}</strong> for order <strong>${esc(o.ref)}</strong>.</p><p>${esc(when)}</p>${button(o.orderUrl, "View your order")}${muted("Questions about it? Reply to this email.")}`
    ),
    text: `Your refund is on its way\n\n${o.storeName} has refunded ${o.amount} for order ${o.ref}.\n${when}\n\nYour order: ${o.orderUrl}`,
  };
}

/* Creator: a new order came in ----------------------------------------------------------- */

export function newOrderMail(o: { storeName: string; ownerName: string; ref: string; buyerName: string; lines: { title: string; amount: string }[]; total: string; cod?: boolean; ships?: boolean; orderUrl: string }): Omit<Mail, "to"> {
  const next = o.cod ? "It's cash on delivery: send it, and collect the money when it arrives." : o.ships ? "It's paid. Pack it and add tracking when it's on its way." : "It's paid, and the buyer already has their download.";
  return {
    subject: `New order on ${o.storeName}: ${o.total} (${o.ref})`,
    html: shell(
      `New order, ${o.ownerName.split(" ")[0] || "there"}!`,
      `<p>${esc(o.buyerName)} just placed order <strong>${esc(o.ref)}</strong> on ${esc(o.storeName)}.</p>${table(o.lines, { label: o.cod ? "To collect" : "Total", amount: o.total })}<p>${esc(next)}</p>${button(o.orderUrl, "See the order")}`,
      OWN
    ),
    text: `New order on ${o.storeName}\n\n${o.buyerName} placed order ${o.ref}.\n${o.lines.map((l) => `${l.title}  ${l.amount}`).join("\n")}\nTotal ${o.total}\n\n${next}\nSee the order: ${o.orderUrl}`,
  };
}

/* Creator: a payout was sent, or came back ----------------------------------------------- */

export function payoutMail(o: { ownerName: string; amount: string; to: string; ok: boolean; reason?: string; payoutsUrl: string }): Omit<Mail, "to"> {
  const hi = `Hi ${esc(o.ownerName.split(" ")[0] || "there")}, `;
  return {
    subject: o.ok ? `${o.amount} is on its way to you` : `Your payout of ${o.amount} didn't go through`,
    html: shell(
      o.ok ? `${o.amount} is on its way` : "Your payout didn't go through",
      o.ok
        ? `<p>${hi}we sent <strong>${esc(o.amount)}</strong> to ${esc(o.to)}. Most banks show it within a few hours; some take until the next working day.</p>${button(o.payoutsUrl, "View payouts")}`
        : `<p>${hi}the payout of <strong>${esc(o.amount)}</strong> to ${esc(o.to)} came back${o.reason ? `: ${esc(o.reason)}` : "."}</p><p>The money is back in your PowerProof balance. Check your payout details and withdraw again.</p>${button(o.payoutsUrl, "Check payout details")}`,
      OWN
    ),
    text: o.ok ? `${o.amount} is on its way to ${o.to}.\n\nPayouts: ${o.payoutsUrl}` : `Your payout of ${o.amount} to ${o.to} didn't go through${o.reason ? `: ${o.reason}` : ""}.\nThe money is back in your balance.\n\nPayouts: ${o.payoutsUrl}`,
  };
}
