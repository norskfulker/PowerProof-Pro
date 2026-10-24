import { esc } from "@/lib/server/email";
import { a, GEIST_CSS } from "@/emails/agents/style";

/**
 * A reminder email as HTML, in the agents' look (emails/agents/style.ts): the business name as an
 * ExtraBold text wordmark, the message in a white card, a quiet footer with the unsubscribe link.
 * Table layout and inline styles, because that's what mail apps render reliably.
 */

const css = (o: Record<string, string | number>) =>
  Object.entries(o)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${typeof v === "number" ? `${v}px` : v}`)
    .join(";");

const P = css({ fontFamily: a.font, fontSize: 16, lineHeight: "1.6", color: a.ink, margin: "0 0 16px" });

/** Paragraphs from plain text: a blank line starts a new one, single line breaks stay */
export function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p style="${P}">${esc(para.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function reminderEmailHtml(o: { brand: string; body: string; unsubscribeUrl?: string; notice?: string; preheader?: string }): string {
  const brand = esc(o.brand);
  const preheader = esc((o.preheader ?? o.body.replace(/\s+/g, " ")).slice(0, 110));
  const notice = o.notice
    ? `<tr><td style="padding:0 0 16px"><div style="${css({ fontFamily: a.font, fontSize: 14, lineHeight: "1.5", color: a.noticeInk, background: a.notice, borderRadius: a.radiusSmall, padding: "12px 14px" })}">${esc(o.notice)}</div></td></tr>`
    : "";
  const footer = [`Sent by PowerProof for ${brand}.`, o.unsubscribeUrl ? `<a href="${esc(o.unsubscribeUrl)}" style="color:${a.muted};text-decoration:underline">Unsubscribe from these reminders</a>` : ""].filter(Boolean).join(" ");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${brand}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="${GEIST_CSS}" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${a.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${a.page}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px"><p style="${css({ fontFamily: a.font, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em", lineHeight: "1.2", color: a.ink, margin: 0 })}">${brand}</p></td></tr>
${notice}
<tr><td style="${css({ background: a.card, border: `1px solid ${a.border}`, borderRadius: a.radius, padding: "28px 26px 12px" })}">${paragraphs(o.body)}</td></tr>
<tr><td style="padding:16px 4px 0"><p style="${css({ fontFamily: a.font, fontSize: 13, lineHeight: "1.5", color: a.muted, margin: 0 })}">${footer}</p></td></tr>
</table></td></tr></table></body></html>`;
}
