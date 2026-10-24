import { fillPlaceholders } from "@/lib/agents/guardrails";
import { daysBetween, formatDayIN } from "@/lib/agents/time";
import { formatMoney } from "@/lib/money";
import { invoiceList, type ChaserChannel, type Language, type Rules, type Tone } from "./plan";

/** The owner's settings for this agent, typed (the platform has already checked them against the manifest) */
export interface ChaserSettings {
  channels: ChaserChannel[];
  tone: Tone;
  language: Language;
  cadence: number[];
  send_window: string;
  sender_name: string;
  pay_details: string;
  daily_cap: number;
}

export function chaserSettings(s: Record<string, unknown>): ChaserSettings {
  return {
    channels: (Array.isArray(s.channels) ? s.channels : ["email", "whatsapp"]) as ChaserChannel[],
    tone: s.tone === "firm" ? "firm" : "friendly",
    language: s.language === "hinglish" ? "hinglish" : "english",
    cadence: (Array.isArray(s.cadence) ? s.cadence.map(Number) : [1, 7, 14, 30]).slice(0, 4),
    send_window: typeof s.send_window === "string" ? s.send_window : "09:00-20:00",
    sender_name: typeof s.sender_name === "string" ? s.sender_name : "",
    pay_details: typeof s.pay_details === "string" ? s.pay_details : "",
    daily_cap: Number(s.daily_cap) || 100,
  };
}

export const rulesFrom = (s: ChaserSettings, gapDays: number): Rules => ({ channels: s.channels, tone: s.tone, language: s.language, cadence: s.cadence, dailyCap: s.daily_cap, gapDays });

/** Facts are plain text: braces are dropped so a name can never look like a placeholder */
const plain = (s: string) => s.replace(/\{\{|\}\}/g, "").trim();

export const NO_PAY_DETAILS = "a reply to this message, and we'll share our payment details";

/** The facts for one reminder, worked out from the invoices as they are right now */
export function factsFor(o: { customerName: string; invoices: { invoiceNo: string; outstandingMinor: number; dueDate: string }[]; businessName: string; payDetails: string; today: string }): Record<string, string> {
  const sorted = [...o.invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.invoiceNo.localeCompare(b.invoiceNo));
  const oldest = sorted[0]?.dueDate ?? o.today;
  return {
    customer_name: plain(o.customerName),
    amount: formatMoney({ amount: sorted.reduce((n, i) => n + i.outstandingMinor, 0), currency: "INR" }),
    invoice_list: invoiceList(sorted.map((i) => plain(i.invoiceNo))),
    due_date: formatDayIN(oldest),
    days_overdue: String(Math.max(0, daysBetween(oldest, o.today))),
    business_name: plain(o.businessName),
    pay_link_or_details: plain(o.payDetails) || NO_PAY_DETAILS,
  };
}

/** Fills the wording, then checks every fact really is in the message (the model can't drop or alter one) */
export function render(wording: { subject: string | null; body: string }, facts: Record<string, string>): { subject: string | null; body: string } {
  const body = fillPlaceholders(wording.body, facts);
  for (const k of ["customer_name", "amount", "invoice_list", "business_name", "pay_link_or_details"]) {
    if (!body.includes(facts[k])) throw new Error(`The reminder lost ${k}.`);
  }
  return { subject: wording.subject ? fillPlaceholders(wording.subject, facts) : null, body };
}
