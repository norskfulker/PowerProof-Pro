import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FaqAccordion({ items, className }: { items: FaqItem[]; className?: string }) {
  if (items.length === 0) return <p className="text-muted-foreground">No questions yet.</p>;
  return (
    <Accordion type="single" collapsible className={cn("rounded-card border bg-surface px-5", className)}>
      {items.map((f) => (
        <AccordionItem key={f.id} value={f.id}>
          <AccordionTrigger className="min-h-14 text-base font-semibold">{f.q}</AccordionTrigger>
          <AccordionContent className="text-base text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
