import { feeBreakdown, PRICING } from "@/lib/money";
import type { Money } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MoneyText } from "./money-text";

/** Sale price → what the creator keeps. Same maths everywhere (pricing page, editor, order). */
export function FeeBreakdown({
  sale,
  className,
  title = "What you keep",
}: {
  sale: Money;
  className?: string;
  title?: string;
}) {
  const f = feeBreakdown(sale);
  const rows: [string, Money, string?][] = [
    ["Sale price", f.sale],
    [`Payment gateway (~${PRICING.gatewayFeePct}%)`, { ...f.gateway, amount: -f.gateway.amount }, "Card and UPI processing"],
    [`PowerProof fee (${PRICING.platformFeePct}%)`, { ...f.platform, amount: -f.platform.amount }],
  ];
  return (
    <div className={cn("rounded-card border bg-surface p-5", className)}>
      <p className="eyebrow mb-3">{title}</p>
      <dl className="flex flex-col gap-2.5 text-sm">
        {rows.map(([label, m, hint]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">
              {label}
              {hint && <span className="sr-only">. {hint}</span>}
            </dt>
            <dd>
              <MoneyText value={m} mono />
            </dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-dashed border-border-strong pt-3">
          <dt className="font-semibold">You keep</dt>
          <dd className="text-right">
            <MoneyText value={f.keep} className="font-display text-2xl font-extrabold text-accent-strong" />
            <span className="block font-mono text-[0.6875rem] text-muted-foreground">{f.keepPct.toFixed(1)}% of each sale</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
