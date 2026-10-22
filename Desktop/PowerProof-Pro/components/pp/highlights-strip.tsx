import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The store's real numbers, in order: download, payment, refunds, rating (only once there are reviews) */
export function autoHighlights(refundDays: number, rating: number, reviewCount: number): { title: string; body: string }[] {
  return [
    { title: "Instant download", body: "Right after paying" },
    { title: "Secure payment", body: "UPI, cards, netbanking" },
    { title: `${refundDays}-day refunds`, body: "If it isn't right" },
    ...(reviewCount > 0 ? [{ title: `${rating.toFixed(1)} out of 5`, body: `${formatNumber(reviewCount)} verified reviews` }] : []),
  ];
}

export interface HighlightView {
  key: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
}

/** Trust points with an icon each: joined cells in a strip, or separate cards */
export function HighlightsStrip({ items, look = "strip", className }: { items: HighlightView[]; look?: "strip" | "cards"; className?: string }) {
  const strip = look === "strip";
  return (
    <section aria-label="Why buy here" className={className}>
      <ul className={cn("grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))]", strip ? "gap-px overflow-hidden rounded-card border bg-border" : "gap-3")}>
        {items.map((i) => (
          <li key={i.key} className={cn("flex items-center gap-3 bg-surface p-4 text-foreground", !strip && "rounded-card border")}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">{i.icon}</span>
            <span className="min-w-0 text-left [overflow-wrap:anywhere]">
              <span className="block text-sm font-semibold">{i.title}</span>
              {i.body && <span className="block text-xs text-muted-foreground">{i.body}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
