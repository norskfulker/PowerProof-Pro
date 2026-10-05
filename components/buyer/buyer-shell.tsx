"use client";

import Link from "next/link";
import { Download, RotateCcw, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkipLink } from "@/components/pp/app-shell";
import { LogoMark } from "@/components/pp/logo";
import { CURRENCIES } from "@/lib/money";
import type { CurrencyCode, Store } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CurrencyPicker({ value, onChange }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CurrencyCode)}>
      <SelectTrigger size="sm" className="w-[104px] font-mono text-xs" aria-label="Show prices in">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
          <SelectItem key={c} value={c}>
            <span className="font-mono text-xs">{c}</span> <span className="text-muted-foreground">{CURRENCIES[c].symbol}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TrustBar({ refundDays, className }: { refundDays?: number; className?: string }) {
  const items = [
    { icon: Download, label: "Instant download" },
    { icon: RotateCcw, label: refundDays ? `${refundDays}-day refund policy` : "Refund policy below" },
    { icon: ShieldCheck, label: "Secure payment" },
  ];
  return (
    <ul className={cn("grid grid-cols-3 gap-2 rounded-card border bg-surface p-3 text-center text-xs sm:text-sm", className)} aria-label="Why it's safe to buy">
      {items.map((i) => (
        <li key={i.label} className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-center sm:gap-2">
          <i.icon className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="font-medium">{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Buyer pages: store-branded header, no creator chrome, help links on every page. */
export function BuyerShell({
  store,
  currency,
  onCurrency,
  children,
  narrow,
}: {
  store?: Store;
  currency?: CurrencyCode;
  onCurrency?: (c: CurrencyCode) => void;
  children: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="border-b bg-surface">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4 md:px-6", narrow ? "max-w-[640px]" : "max-w-[1120px]")}>
          {store ? (
            <Link href={`/s/${store.slug}`} className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-control">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] font-mono text-xs font-semibold text-primary-foreground" style={{ background: store.brandColor }}>
                {store.logoText}
              </span>
              <span className="truncate font-display text-lg">{store.name}</span>
            </Link>
          ) : (
            <span className="h-9 w-40 animate-pulse rounded-control bg-muted" aria-hidden />
          )}
          {currency && onCurrency && (
            <div className="ml-auto">
              <CurrencyPicker value={currency} onChange={onCurrency} />
            </div>
          )}
        </div>
      </header>
      <main id="main" className={cn("mx-auto w-full flex-1 px-4 py-6 md:px-6 md:py-10", narrow ? "max-w-[640px]" : "max-w-[1120px]")}>
        {children}
      </main>
      <footer className="border-t bg-surface">
        <div className={cn("mx-auto flex flex-col gap-3 px-4 py-6 text-sm md:flex-row md:items-center md:px-6", narrow ? "max-w-[640px]" : "max-w-[1120px]")}>
          <nav aria-label="Help" className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/lookup" className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline">Find my order</Link>
            <Link href="/lookup#help" className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline">Refunds and support</Link>
            {store && <a href={`mailto:${store.supportEmail}`} className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:underline">{store.supportEmail}</a>}
          </nav>
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground md:ml-auto">
            <LogoMark className="size-4" /> Sold with PowerProof
          </Link>
        </div>
      </footer>
    </div>
  );
}

export function ConversionNote({ currency, className }: { currency: CurrencyCode; className?: string }) {
  if (currency === "INR") return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Prices in {CURRENCIES[currency].name}s are converted from Indian rupees at today&apos;s rate. You&apos;re charged in {currency}; your bank may add its own fee.
    </p>
  );
}
