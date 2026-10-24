import { t } from "../theme";

/**
 * The look of every email PowerProof Agents sends (reminders to customers, test emails, reports
 * to owners): Geist, a plain text wordmark in ExtraBold (no icon or tile), one white card.
 * Mail apps that block web fonts (Gmail, Outlook) fall back to the system sans-serif.
 */
export const GEIST_CSS = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;800&display=swap";

export const a = {
  font: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  page: t.porcelain,
  card: t.surface,
  ink: t.ink,
  muted: t.muted,
  border: t.border,
  accent: t.emerald,
  accentSoft: t.emeraldSoft,
  notice: "#FFF4D6",
  noticeInk: "#5C4410",
  radius: "16px",
  radiusSmall: "10px",
} as const;

export const wordmark = { fontFamily: a.font, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em", lineHeight: "1.2", color: a.ink, margin: 0 } as const;
export const h1 = { fontFamily: a.font, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em", lineHeight: "1.2", color: a.ink, margin: "0 0 12px" } as const;
export const p = { fontFamily: a.font, fontSize: 16, lineHeight: "1.6", color: a.ink, margin: "0 0 16px" } as const;
export const small = { fontFamily: a.font, fontSize: 13, lineHeight: "1.5", color: a.muted, margin: 0 } as const;
export const eyebrow = { fontFamily: a.font, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: a.muted, margin: "0 0 8px" } as const;
export const button = { display: "inline-block", fontFamily: a.font, fontWeight: 600, fontSize: 15, color: "#FFFFFF", backgroundColor: a.accent, padding: "13px 22px", borderRadius: a.radiusSmall, textDecoration: "none" } as const;
