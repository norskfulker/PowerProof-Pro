import { daysBetween } from "@/lib/agents/time";

/**
 * Who gets a reminder today, and which one. Pure code, enforced here and never left to the model:
 * cadence, stages, grouping one customer's overdue invoices into one message, pauses, opt-outs,
 * the per-customer gap and the daily cap. Safe to run every hour: the same inputs give the same plan,
 * and each reminder's key (customer + stage + the chase's start date) can only ever be sent once.
 */

export type Tone = "friendly" | "firm";
export type Language = "english" | "hinglish";
export type ChaserChannel = "email" | "whatsapp" | "sms";

export interface Rules {
  channels: ChaserChannel[];
  tone: Tone;
  language: Language;
  cadence: number[];
  dailyCap: number;
  /** Days between two messages to one customer */
  gapDays: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isPaused: boolean;
  optedOutAt: string | null;
  languagePref: Language | null;
}

export interface OpenInvoice {
  id: string;
  customerId: string;
  invoiceNo: string;
  dueDate: string;
  outstandingMinor: number;
}

export interface PastReminder {
  customerId: string;
  stage: number;
  anchor: string;
  status: "drafted" | "queued" | "approved" | "sent" | "failed" | "skipped" | "snoozed";
  /** When it went out (sent) or was queued, ISO */
  at: string | null;
}

export interface PlanItem {
  key: string;
  customerId: string;
  stage: number;
  anchor: string;
  channel: ChaserChannel;
  tone: Tone;
  language: Language;
  invoiceIds: string[];
  totalMinor: number;
  oldestDue: string;
  daysOverdue: number;
}

export type Skip = { customerId: string; reason: "paused" | "opted_out" | "no_contact" | "too_soon" | "daily_cap" };

export interface Plan {
  items: PlanItem[];
  skipped: Skip[];
  /** Every stage done and still unpaid: the owner should call */
  personalCalls: { customerId: string; anchor: string; totalMinor: number; daysOverdue: number }[];
}

export const reminderKey = (customerId: string, stage: number, anchor: string) => `${customerId}:${stage}:${anchor}`;

/** Stage 1–2 use the owner's tone; 3 and the final notice are firm (still polite) */
export const toneFor = (stage: number, base: Tone): Tone => (stage >= 3 ? "firm" : base);

export function pickChannel(c: Customer, channels: readonly ChaserChannel[]): ChaserChannel | null {
  if (channels.includes("email") && c.email) return "email";
  if (channels.includes("whatsapp") && c.phone) return "whatsapp";
  return null;
}

const LIVE = new Set(["drafted", "queued", "approved", "sent", "snoozed"]);

export function planReminders(o: { today: string; now: Date; rules: Rules; customers: Customer[]; invoices: OpenInvoice[]; history: PastReminder[]; sentToday: number }): Plan {
  const plan: Plan = { items: [], skipped: [], personalCalls: [] };
  const byCustomer = new Map<string, OpenInvoice[]>();
  for (const inv of o.invoices) {
    if (inv.outstandingMinor <= 0 || daysBetween(inv.dueDate, o.today) < 1) continue;
    byCustomer.set(inv.customerId, [...(byCustomer.get(inv.customerId) ?? []), inv]);
  }
  const customers = new Map(o.customers.map((c) => [c.id, c]));
  const candidates: PlanItem[] = [];

  for (const [customerId, invs] of byCustomer) {
    const c = customers.get(customerId);
    if (!c) continue;
    const sorted = [...invs].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.invoiceNo.localeCompare(b.invoiceNo));
    const anchor = sorted[0].dueDate;
    const daysOverdue = daysBetween(anchor, o.today);
    const totalMinor = sorted.reduce((n, i) => n + i.outstandingMinor, 0);
    const mine = o.history.filter((h) => h.customerId === customerId);
    const stagesThisChase = mine.filter((h) => h.anchor === anchor && LIVE.has(h.status)).map((h) => h.stage);
    const pending = mine.find((h) => h.anchor === anchor && (h.status === "drafted" || h.status === "approved"));
    const doneStage = Math.max(0, ...stagesThisChase.filter((s) => !pending || s !== pending.stage));
    const stage = pending ? pending.stage : doneStage + 1;

    if (c.isPaused) {
      plan.skipped.push({ customerId, reason: "paused" });
      continue;
    }
    if (c.optedOutAt) {
      plan.skipped.push({ customerId, reason: "opted_out" });
      continue;
    }
    if (stage > o.rules.cadence.length) {
      const last = o.rules.cadence[o.rules.cadence.length - 1] ?? 0;
      if (daysOverdue >= last + o.rules.gapDays) plan.personalCalls.push({ customerId, anchor, totalMinor, daysOverdue });
      continue;
    }
    if (daysOverdue < o.rules.cadence[stage - 1]) continue;
    const lastAt = Math.max(0, ...mine.filter((h) => h.at && (h.status === "sent" || h.status === "queued")).map((h) => Date.parse(h.at!)));
    if (!pending && lastAt && o.now.getTime() - lastAt < o.rules.gapDays * 86_400_000) {
      plan.skipped.push({ customerId, reason: "too_soon" });
      continue;
    }
    const channel = pickChannel(c, o.rules.channels);
    if (!channel) {
      plan.skipped.push({ customerId, reason: "no_contact" });
      continue;
    }
    candidates.push({
      key: reminderKey(customerId, stage, anchor),
      customerId,
      stage,
      anchor,
      channel,
      tone: toneFor(stage, o.rules.tone),
      language: c.languagePref ?? o.rules.language,
      invoiceIds: sorted.map((i) => i.id),
      totalMinor,
      oldestDue: anchor,
      daysOverdue,
    });
  }

  // Longest overdue first, then biggest, so the daily cap keeps the most important ones
  candidates.sort((a, b) => b.daysOverdue - a.daysOverdue || b.totalMinor - a.totalMinor || a.key.localeCompare(b.key));
  const room = Math.max(0, o.rules.dailyCap - o.sentToday);
  plan.items = candidates.slice(0, room);
  for (const c of candidates.slice(room)) plan.skipped.push({ customerId: c.customerId, reason: "daily_cap" });
  return plan;
}

/** "invoice INV-7" or "invoices INV-7, INV-9 and 2 more" */
export function invoiceList(nos: string[]): string {
  if (nos.length === 1) return `invoice ${nos[0]}`;
  if (nos.length <= 3) return `invoices ${nos.slice(0, -1).join(", ")} and ${nos[nos.length - 1]}`;
  return `invoices ${nos.slice(0, 2).join(", ")} and ${nos.length - 2} more`;
}
