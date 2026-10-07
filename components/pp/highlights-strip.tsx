import { Download, RotateCcw, ShieldCheck, Star } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function HighlightsStrip({
  refundDays,
  rating,
  reviewCount,
  className,
}: {
  refundDays: number;
  rating: number;
  reviewCount: number;
  className?: string;
}) {
  const items = [
    { icon: Download, title: "Instant download", body: "Right after paying" },
    { icon: ShieldCheck, title: "Secure payment", body: "UPI, cards, netbanking" },
    { icon: RotateCcw, title: `${refundDays}-day refunds`, body: "If it isn't right" },
    reviewCount > 0 && { icon: Star, title: `${rating.toFixed(1)} out of 5`, body: `${formatNumber(reviewCount)} verified reviews` },
  ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; title: string; body: string }[];

  return (
    <section aria-label="Why buy here" className={cn("mx-auto max-w-[1200px] px-4 md:px-6", className)}>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-px overflow-hidden rounded-card border bg-border">
        {items.map((i) => (
          <li key={i.title} className="flex items-center gap-3 bg-surface p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <i.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <span className="block text-sm font-semibold">{i.title}</span>
              <span className="block text-xs text-muted-foreground">{i.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
