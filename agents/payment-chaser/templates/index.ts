import type { ChaserChannel, Language, Tone } from "../lib/plan";

/**
 * Static reminders: what goes out when the model is off, slow, or writes something that fails the
 * checks. Wording only; every fact is a placeholder the app fills. No digits on purpose (a test
 * checks every template passes the same checks as the model's answers).
 */

export const PLACEHOLDERS = ["customer_name", "amount", "invoice_list", "due_date", "days_overdue", "business_name", "pay_link_or_details"] as const;
export const REQUIRED = ["{{customer_name}}", "{{amount}}", "{{invoice_list}}", "{{business_name}}", "{{pay_link_or_details}}"];

type Wording = { subject: string; body: string };
type Table = Record<Language, Record<Tone, Record<1 | 2 | 3 | 4, Wording>>>;

const T: Table = {
  english: {
    friendly: {
      1: { subject: "A quick reminder from {{business_name}}", body: "Hi {{customer_name}}, hope you're doing well. Just a gentle reminder that {{invoice_list}} for {{amount}} was due on {{due_date}}. It may have slipped through, no worries. You can pay via {{pay_link_or_details}}. Could you let us know when you'll be able to pay?\n\nThanks,\n{{business_name}}" },
      2: { subject: "Reminder: {{amount}} pending", body: "Hi {{customer_name}}, following up on {{invoice_list}} for {{amount}}, due on {{due_date}}. You can pay via {{pay_link_or_details}}. Please reply with the date you'll pay, so we can update our records.\n\nThank you,\n{{business_name}}" },
      3: { subject: "Payment overdue: {{amount}}", body: "Hello {{customer_name}}, {{invoice_list}} for {{amount}} is now {{days_overdue}} days past its due date of {{due_date}}. We'd be grateful if you could clear it via {{pay_link_or_details}}, or reply with a date when you will pay.\n\nRegards,\n{{business_name}}" },
      4: { subject: "Final reminder: {{amount}} overdue", body: "Hello {{customer_name}}, this is our final reminder about {{invoice_list}} for {{amount}}, due on {{due_date}} and now {{days_overdue}} days overdue. Please pay via {{pay_link_or_details}}, or reply today with the date you'll pay so we can plan.\n\nRegards,\n{{business_name}}" },
    },
    firm: {
      1: { subject: "Payment due: {{amount}}", body: "Hello {{customer_name}}, {{invoice_list}} for {{amount}} was due on {{due_date}} and is still unpaid. Please pay via {{pay_link_or_details}}, or reply with the date you will pay.\n\nRegards,\n{{business_name}}" },
      2: { subject: "Second reminder: {{amount}} unpaid", body: "Hello {{customer_name}}, {{invoice_list}} for {{amount}} is {{days_overdue}} days past its due date of {{due_date}}. Please pay via {{pay_link_or_details}}, or reply with a firm payment date.\n\nRegards,\n{{business_name}}" },
      3: { subject: "Payment overdue: {{amount}}", body: "Hello {{customer_name}}, {{invoice_list}} for {{amount}} is now {{days_overdue}} days overdue (due {{due_date}}). Please clear it via {{pay_link_or_details}} or reply with the date you will pay.\n\nRegards,\n{{business_name}}" },
      4: { subject: "Final reminder: {{amount}} overdue", body: "Hello {{customer_name}}, this is our final reminder for {{invoice_list}} for {{amount}}, due on {{due_date}} and {{days_overdue}} days overdue. Please pay via {{pay_link_or_details}}, or reply today with your payment date.\n\nRegards,\n{{business_name}}" },
    },
  },
  hinglish: {
    friendly: {
      1: { subject: "{{business_name}} se ek chhota reminder", body: "Namaste {{customer_name}} ji, umeed hai sab badhiya hai. Bas yaad dilana tha ki {{invoice_list}} ka {{amount}} {{due_date}} ko due tha. Shayad dhyan se nikal gaya hoga. Aap {{pay_link_or_details}} par pay kar sakte hain. Kab tak pay kar paayenge, bata dijiye?\n\nDhanyavaad,\n{{business_name}}" },
      2: { subject: "Reminder: {{amount}} pending hai", body: "Namaste {{customer_name}} ji, {{invoice_list}} ka {{amount}} {{due_date}} ko due tha, abhi tak pending hai. Aap {{pay_link_or_details}} par pay kar sakte hain. Payment ki date reply karke bata dijiye.\n\nDhanyavaad,\n{{business_name}}" },
      3: { subject: "Payment overdue: {{amount}}", body: "Namaste {{customer_name}} ji, {{invoice_list}} ka {{amount}} ab due date {{due_date}} se {{days_overdue}} din upar ho gaya hai. Kripya {{pay_link_or_details}} par payment kar dijiye, ya reply karke date bata dijiye.\n\nDhanyavaad,\n{{business_name}}" },
      4: { subject: "Aakhri reminder: {{amount}}", body: "Namaste {{customer_name}} ji, yeh {{invoice_list}} ke {{amount}} ke liye hamara aakhri reminder hai. Due date {{due_date}} thi, ab {{days_overdue}} din ho gaye hain. Kripya {{pay_link_or_details}} par pay kar dijiye, ya aaj hi payment ki date bata dijiye.\n\nDhanyavaad,\n{{business_name}}" },
    },
    firm: {
      1: { subject: "Payment due: {{amount}}", body: "Namaste {{customer_name}} ji, {{invoice_list}} ka {{amount}} {{due_date}} ko due tha aur abhi tak pending hai. Kripya {{pay_link_or_details}} par pay kijiye, ya payment ki date reply kijiye.\n\n{{business_name}}" },
      2: { subject: "Doosra reminder: {{amount}}", body: "Namaste {{customer_name}} ji, {{invoice_list}} ka {{amount}} due date {{due_date}} se {{days_overdue}} din upar ho gaya hai. Kripya {{pay_link_or_details}} par pay kijiye, ya pakki date bata dijiye.\n\n{{business_name}}" },
      3: { subject: "Payment overdue: {{amount}}", body: "Namaste {{customer_name}} ji, {{invoice_list}} ka {{amount}} ab {{days_overdue}} din overdue hai (due {{due_date}}). Kripya {{pay_link_or_details}} par clear kar dijiye ya date reply kijiye.\n\n{{business_name}}" },
      4: { subject: "Aakhri reminder: {{amount}}", body: "Namaste {{customer_name}} ji, {{invoice_list}} ke {{amount}} ke liye yeh aakhri reminder hai. Due date {{due_date}} thi, ab {{days_overdue}} din ho gaye. Kripya {{pay_link_or_details}} par pay kijiye ya aaj hi date bata dijiye.\n\n{{business_name}}" },
    },
  },
};

export const MAX_CHARS: Record<ChaserChannel, number> = { email: 900, whatsapp: 400, sms: 400 };

export function staticTemplate(stage: number, tone: Tone, language: Language, channel: ChaserChannel): { subject: string | null; body: string } {
  const w = T[language][tone][Math.min(4, Math.max(1, stage)) as 1 | 2 | 3 | 4];
  return { subject: channel === "email" ? w.subject : null, body: w.body };
}
