import { defineAgent } from "@/lib/agents/define";

/** Agent #1: reads overdue invoices and reminds customers to pay, on its own, every day. */
export default defineAgent({
  id: "payment-chaser",
  version: "1.0.0",
  name: "Payment Chaser",
  tagline: "Chases overdue invoices so you don't have to.",
  description:
    "Upload your invoices or connect a Google Sheet. Payment Chaser finds who owes you money, writes polite reminders in English or Hinglish, emails them on a schedule you set, and lines up WhatsApp messages for you to send with one tap. It stops the moment an invoice is paid.",
  category: "Finance",
  status: "live",
  dataPrefix: "chaser_",
  trial: { credits: 25 },
  plans: [{ id: "monthly", priceMinor: 99900, launchPriceMinor: 49900, currency: "INR", includedCredits: 300 }],
  creditCosts: { ai_draft: 0, email_sent: 1, sms_sent: 1, whatsapp_queued: 1 },
  llm: { provider: "gemini", model: "default" },
  connectors: [
    { key: "invoices", type: "invoice_source", label: "Your invoices", why: "So the agent knows who owes you what, and since when.", options: ["csv", "xlsx", "sheets", "manual"] },
    { key: "sheet", type: "google_sheets", label: "Google Sheet", why: "Optional: keeps invoices up to date from a sheet you already use.", required: false, options: ["sheets"] },
    { key: "sms", type: "sms_provider", label: "SMS", why: "Text reminders to customers without email.", required: false, disabledUntil: "sms_ready" },
  ],
  setup: [
    { key: "channels", type: "multiselect", label: "How to remind customers", options: [{ value: "email", label: "Email (sent for you)" }, { value: "whatsapp", label: "WhatsApp (you tap send)" }, { value: "sms", label: "SMS", disabled: "Coming soon" }], default: ["email", "whatsapp"] },
    { key: "tone", type: "select", label: "Tone", options: [{ value: "friendly", label: "Friendly" }, { value: "firm", label: "Firm but polite" }], default: "friendly", hint: "Later reminders get firmer on their own; this sets where they start." },
    { key: "language", type: "select", label: "Language", options: [{ value: "english", label: "English" }, { value: "hinglish", label: "Hinglish" }], default: "english" },
    { key: "cadence", type: "day_list", label: "Remind on these days after the due date", default: [1, 7, 14, 30], hint: "Four reminders at most. After the last one, the customer moves to your call list." },
    { key: "send_window", type: "time_range", label: "Send only between", default: "09:00-20:00", hint: "India time. Nothing goes out outside these hours." },
    { key: "sender_name", type: "text", label: "Sign messages as", default: "", maxLength: 60, hint: "Leave empty to use the name on your invoices." },
    { key: "pay_details", type: "text", label: "How customers can pay you", default: "", maxLength: 200, hint: "A UPI ID, payment link or bank details. Shown in every reminder." },
    { key: "daily_cap", type: "number", label: "Most reminders in one day", min: 1, max: 500, default: 100 },
  ],
  triggers: [{ type: "cron", everyMinutes: 60 }, { type: "manual" }],
  steps: ["load_overdue", "draft_messages", "route_and_send", "log_and_meter"],
  actionQueue: ["whatsapp_send", "needs_personal_call", "approve_draft"],
  metrics: [
    { key: "overdue_total", label: "Overdue", kind: "money", explain: "Every open invoice whose due date has passed, minus what was already paid on it.", headline: true },
    { key: "paid_after_reminder_month", label: "Paid after a reminder this month", kind: "money", explain: "Invoices marked paid this month within 14 days after at least one reminder went out.", headline: true },
    { key: "reminders_sent", label: "Reminders sent", kind: "count", explain: "Emails sent and WhatsApp messages you sent from the queue, this month." },
  ],
  report: { schedule: "weekly_monday_9am_ist", template: "weekly_report" },
  consents: ["I confirm these customers owe me this money and I may contact them about it."],
  guardrails: {
    forbiddenPhrases: ["legal action", "legal notice", "court", "police", "lawyer", "advocate", "fir", "penalty", "late fee", "blacklist", "credit score", "cibil", "your family", "your employer", "your boss", "we will visit", "consequences", "warning", "final warning", "kanooni", "case kar"],
    maxMessagesPerContactPerDays: { messages: 1, days: 3 },
    sendWindow: "09:00-20:00",
    dailySendCap: 100,
  },
  howItWorks: [
    { step: "load_overdue", title: "Finds what's overdue", body: "Reads your invoices and picks the ones past their due date that aren't paid, paused or disputed." },
    { step: "draft_messages", title: "Writes the reminder", body: "AI writes a short, polite message per customer. Amounts, dates and invoice numbers are filled in by the app, never by AI." },
    { step: "route_and_send", title: "Sends or queues it", body: "Emails go out inside your sending hours. WhatsApp messages wait in your queue for one tap." },
    { step: "log_and_meter", title: "Keeps score", body: "Every message is logged. Paid invoices stop reminders at once, and you get a summary every Monday." },
  ],
  sample: {
    title: "A first reminder, friendly, English",
    lines: ["Hi {{customer_name}}, hope you're well.", "A gentle reminder that {{invoice_list}} for {{amount}} was due on {{due_date}}.", "You can pay via {{pay_link_or_details}}. Could you share the date you'll pay?", "Thanks, {{business_name}}"],
  },
  highlights: [
    "You see every message before anything goes out: a free dry run comes first.",
    "Nothing is sent outside the hours you choose.",
    "A paid invoice stops its reminders at once.",
    "Customers can opt out with one tap, and are never contacted again.",
  ],
  help: {
    faq: [
      { q: "Will it send anything before I say so?", a: "No. Setup ends with a dry run that shows every message it would send. Nothing goes out until you switch it on." },
      { q: "Can the AI change amounts or dates?", a: "No. AI only writes the wording. Amounts, dates, names and invoice numbers are put in by the app and checked before anything is sent." },
      { q: "What happens when an invoice is paid?", a: "Mark it paid (or upload your file again with it gone, and confirm). Reminders for it stop at once." },
      { q: "How does WhatsApp work?", a: "WhatsApp messages wait in your Send queue. Tap Send next, WhatsApp opens with the message written, you press send." },
      { q: "What do credits pay for?", a: "One credit is one reminder: an email sent or a WhatsApp message prepared. Previews and dry runs are free. When credits run out the agent pauses; nothing is charged without you." },
      { q: "Can my customers stop the messages?", a: "Yes. Every email has an unsubscribe link and every WhatsApp message says how to opt out. Once they do, they get nothing more." },
    ],
  },
});
