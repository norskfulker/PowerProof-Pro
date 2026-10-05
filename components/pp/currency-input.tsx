"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/money";
import type { CurrencyCode, Money } from "@/lib/types";
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

  return (
    <div
      className={cn(
        "flex h-11 w-full items-center rounded-control border border-input bg-surface transition-[border-color] duration-150 hover:border-foreground/50",
        "focus-within:border-primary focus-within:outline-2 focus-within:outline-primary",
        invalid && "border-danger focus-within:outline-danger",
        disabled && "opacity-60",
        className
      )}
    >
      <span className="pl-3.5 pr-1 font-mono text-sm text-muted-foreground" aria-hidden>
        {symbol}
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        className="h-full w-full min-w-0 bg-transparent pr-3.5 text-base tabular outline-none placeholder:text-muted-foreground"
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
      <span className="pr-3.5 font-mono text-[11px] text-muted-foreground">{currency}</span>
    </div>
  );
}
