import { addDays, daysBetween } from "./time";
import type { ReplyRule } from "./schedule";

/**
 * What a customer's reply means, and what the agent does about it. Plain rules, never a model:
 * the same reply always gets the same answer, and a person can read why. Pure and unit-tested.
 */

export type ReplyIntent = "paid" | "promise" | "dispute" | "stop" | "other";

const PAID = /\b(paid|have paid|already paid|payment (done|made|sent)|transferred|sent the (money|payment)|cleared|settled|done the payment|kar diya|kar di|bhej diya|bhej di|de diya|ho gaya)\b/i;
const STOP = /\b(stop|unsubscribe|don'?t (message|contact|email)|do not (message|contact|email)|remove me|mat bhejo|band karo)\b/i;
const DISPUTE = /\b(wrong|incorrect|not (mine|ours|ordered|received|delivered)|never (ordered|received|got)|dispute|mistake|galat|nahi (mila|liya|manga))\b/i;
const PROMISE = /\b(will pay|i'?ll pay|we'?ll pay|pay (by|on|next|this|tomorrow|today)|paying (by|on|next|this|tomorrow)|next week|tomorrow|kal|parso|end of (the )?(week|month)|by \d{1,2}(st|nd|rd|th)?\b|kar dunga|kar denge|de dunga|de denge)\b/i;

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

/** The pay date a reply names, if it names one clearly ("tomorrow", "by 5th", "on 12 Nov"), as an India date */
export function promisedDate(text: string, today: string): string | null {
  const t = text.toLowerCase();
  if (/\b(today|aaj)\b/.test(t)) return today;
  if (/\b(tomorrow|kal)\b/.test(t)) return addDays(today, 1);
  if (/\bparso\b/.test(t)) return addDays(today, 2);
  if (/\bnext week\b/.test(t)) return addDays(today, 7);
  if (/\bend of (the )?week\b/.test(t)) return addDays(today, 5);
  const [y, m] = today.split("-").map(Number);
  if (/\bend of (the )?month\b/.test(t)) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${pad(m)}-${pad(last)}`;
  }
  const named = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\b/) ?? t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (named) {
    const [day, mon] = /^\d/.test(named[1]) ? [Number(named[1]), MONTHS[named[2].slice(0, 3)]] : [Number(named[2]), MONTHS[named[1].slice(0, 3)]];
    if (day >= 1 && day <= 31 && mon) {
      let d = `${y}-${pad(mon)}-${pad(day)}`;
      if (daysBetween(today, d) < 0) d = `${y + 1}-${pad(mon)}-${pad(day)}`;
      return d;
    }
  }
  const nth = t.match(/\b(?:by|on|before)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/);
  if (nth) {
    const day = Number(nth[1]);
    if (day >= 1 && day <= 31) {
      let d = `${y}-${pad(m)}-${pad(day)}`;
      if (daysBetween(today, d) < 0) d = m === 12 ? `${y + 1}-01-${pad(day)}` : `${y}-${pad(m + 1)}-${pad(day)}`;
      return d;
    }
  }
  return null;
}

/** Strongest meaning first: a stop request beats everything, then a dispute, a payment, a promise */
export function classifyReply(text: string, today: string): { intent: ReplyIntent; promisedOn: string | null } {
  if (STOP.test(text)) return { intent: "stop", promisedOn: null };
  if (DISPUTE.test(text)) return { intent: "dispute", promisedOn: null };
  if (PAID.test(text)) return { intent: "paid", promisedOn: null };
  const on = promisedDate(text, today);
  if (on || PROMISE.test(text)) return { intent: "promise", promisedOn: on };
  return { intent: "other", promisedOn: null };
}

export type ReplyDecision =
  /** No more messages to this contact until the owner switches them back on */
  | { action: "stop"; review: boolean; applied: string }
  /** No messages before `until` (an India date), then carry on */
  | { action: "snooze"; until: string; review: boolean; applied: string }
  | { action: "keep"; review: boolean; applied: string };

/**
 * What the owner's reply rule does with one reply. `review`: the owner gets a "Reply to check" item
 * in their queue. A stop request always stops (that's the customer's right), whatever the rule.
 */
export function decideReply(rule: ReplyRule, intent: ReplyIntent, o: { promisedOn: string | null; pauseDays: number; today: string }): ReplyDecision {
  if (intent === "stop") return { action: "stop", review: true, applied: "stopped" };
  const snooze = (until: string, review: boolean): ReplyDecision => ({ action: "snooze", until, review, applied: `snoozed_until:${until}` });
  switch (rule) {
    case "stop":
      return { action: "stop", review: true, applied: "stopped" };
    case "pause":
      return snooze(addDays(o.today, o.pauseDays), intent === "paid" || intent === "dispute");
    case "keep":
      return { action: "keep", review: intent === "paid" || intent === "dispute", applied: "kept" };
    case "auto":
      if (intent === "paid" || intent === "dispute") return { action: "stop", review: true, applied: "stopped" };
      // A day's grace after the date they named, so a payment that's on its way isn't chased
      if (intent === "promise" && o.promisedOn && daysBetween(o.today, o.promisedOn) >= 0) return snooze(addDays(o.promisedOn, 1), false);
      return snooze(addDays(o.today, o.pauseDays), true);
  }
}

export const INTENT_LABEL: Record<ReplyIntent, string> = {
  paid: "Says paid",
  promise: "Will pay",
  dispute: "Disputes it",
  stop: "Asked to stop",
  other: "Replied",
};

/** "Stopped" / "Waiting until 02 Nov" / "Carrying on", for the replies table */
export function appliedLabel(applied: string, formatDay: (d: string) => string): string {
  if (applied === "stopped") return "Stopped";
  if (applied === "kept") return "Carrying on";
  if (applied.startsWith("snoozed_until:")) return `Waiting until ${formatDay(applied.slice(14))}`;
  return applied || "—";
}
