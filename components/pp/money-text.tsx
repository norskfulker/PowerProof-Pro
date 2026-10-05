import { formatMoney } from "@/lib/money";
import type { Money } from "@/lib/types";
import { cn } from "@/lib/utils";

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
