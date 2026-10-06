import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const FAQS: [string, string][] = [
  ["Do I need a company or GST number?", "No. Individuals can sell from day one. Add GST details later and your invoices update on their own."],
  ["How do buyers get the file?", "Right after paying they land on a download page, and the same link arrives by email. No account, no password, no waiting."],
  ["When do I get my money?", "Each sale is held for 3 hours after payment, then it's yours to withdraw any time, in any amount above ₹100."],
  ["Can people outside India buy?", "Yes. Buyers see prices in their own currency and pay by card. You receive rupees."],
  ["What does it cost?", "Your first month is free. Then $20 a month, plus 3% per sale. The payment gateway takes about 2% on top."],
  ["Can I use my own website?", "Yes. Paste your own HTML into a page, or drop our embed code into any site. Buy buttons work either way."],
];

export function Faq({ items = FAQS }: { items?: [string, string][] }) {
  return (
    <Accordion type="single" collapsible className="rounded-card border bg-surface px-5">
      {items.map(([q, a]) => (
        <AccordionItem key={q} value={q}>
          <AccordionTrigger className="min-h-14 text-base font-semibold">{q}</AccordionTrigger>
          <AccordionContent className="text-base text-muted-foreground">{a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
