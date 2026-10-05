/**
 * Masking for personal data shown to platform staff. The full value is only shown after an
 * explicit Reveal, which is written to the audit log (lib/api/search.ts → revealContact).
 */

const DOT = "•";

/** "priya.sharma@gmail.com" → "pr••••@gmail.com". Keeps the domain so staff can tell accounts apart. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return DOT.repeat(4);
  const local = email.slice(0, at);
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}${DOT.repeat(4)}${email.slice(at)}`;
}

/** "+91 98765 43210" → "+91 ••••••3210". Keeps the country code and the last four digits. */
export function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  const cc = trimmed.match(/^\+\d{1,3}/)?.[0] ?? "";
  const digits = trimmed.slice(cc.length).replace(/\D/g, "");
  if (digits.length <= 4) return `${cc}${cc ? " " : ""}${DOT.repeat(4)}`;
  return `${cc}${cc ? " " : ""}${DOT.repeat(Math.min(6, digits.length - 4))}${digits.slice(-4)}`;
}

/** Digits only, for matching "+91 98765-43210" against "9876543210". */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}
