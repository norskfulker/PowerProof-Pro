"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/money";
import type { CurrencyCode, Money } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Money input. Holds a Money (minor units) but lets people type "1,499" or "1499.5".
 */
export function CurrencyInput({
  value,
  onChange,
  currency = "INR",
  id,
  invalid,
  placeholder = "0.00",
  className,
  disabled,
  "aria-describedby": describedBy,
  onBlur,
}: {
  value: Money | undefined;
  onChange: (m: Money | undefined) => void;
  currency?: CurrencyCode;
  id?: string;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  onBlur?: () => void;
}) {
  const format = (m?: Money) => (m ? (m.amount / 100).toFixed(2) : "");
  // While focused we show exactly what was typed; otherwise the formatted value.
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const symbol = CURRENCIES[currency].symbol;

  // The shared Input, with the symbol and currency code drawn inside its padding
  return (
    <div className={cn("relative w-full", disabled && "opacity-60", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-muted-foreground" aria-hidden>
        {symbol}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        className="pr-12 pl-8 tabular"
        value={focused ? text : format(value)}
        onFocus={() => {
          setText(format(value));
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.]/g, "");
          setText(e.target.value);
          if (raw === "") return onChange(undefined);
          const n = Number.parseFloat(raw);
          if (!Number.isNaN(n)) onChange({ amount: Math.round(n * 100), currency });
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground" aria-hidden>{currency}</span>
    </div>
  );
}
