import { formatMoney } from "@/lib/money";
import type { Money } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Totals in several currencies, side by side (money from different countries is never added together) */
export function MoneyList({ values, mono, className }: { values: Money[]; mono?: boolean; className?: string }) {
  if (!values.length) return <MoneyText value={{ amount: 0, currency: "INR" }} mono={mono} className={cn("text-muted-foreground", className)} />;
  return (
    <span className={cn("flex flex-col", className)}>
      {values.map((v) => (
        <MoneyText key={v.currency} value={v} mono={mono} />
      ))}
    </span>
  );
}

/** The one place money becomes text. Always symbol + two decimals. */
export function MoneyText({
  value,
  compact,
  signed,
  mono,
  className,
}: {
  value: Money;
  compact?: boolean;
  signed?: boolean;
  /** Use IBM Plex Mono (tables, receipts). */
  mono?: boolean;
  className?: string;
}) {
  const text = formatMoney(value, { compact, signed });
  return (
    <span
      className={cn("tabular whitespace-nowrap", mono && "font-mono text-[0.8125rem]", className)}
      title={compact ? formatMoney(value) : undefined}
    >
      {text}
    </span>
  );
}
