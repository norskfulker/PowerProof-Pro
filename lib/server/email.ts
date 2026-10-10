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

const shell = (title: string, body: string) =>
  `<!doctype html><html><body style="margin:0;background:#f5f6f4;font-family:system-ui,sans-serif;color:#0c1f1b"><div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border:1px solid #dfe5e1;border-radius:12px;padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${body}</div><p style="font-size:12px;color:#6b7b75;text-align:center">Sent by PowerProof on behalf of the store.</p></div></body></html>`;

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
