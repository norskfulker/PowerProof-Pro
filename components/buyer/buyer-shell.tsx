"use client";

import Link from "next/link";
import { Download, RotateCcw, ShieldCheck } from "lucide-react";
import { SkipLink } from "@/components/pp/app-shell";
import { LogoMark } from "@/components/pp/logo";
import type { Store, StoreTheme } from "@/lib/types";
import { StoreThemeScope } from "@/components/pp/store-theme";
import { cn } from "@/lib/utils";

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
  children,
  narrow,
  theme,
  bottomBar,
}: {
  /** A fixed bar sits at the bottom on phones (checkout Pay bar): reserve room for it */
  bottomBar?: boolean;
  store?: Store;
  children: React.ReactNode;
  narrow?: boolean;
  /** The store's theme, so checkout and order pages match the store. */
  theme?: StoreTheme;
}) {
  const body = (
    <div className={cn("flex min-h-dvh flex-col", bottomBar && "max-lg:pb-28")}>
      <SkipLink />
      <header className="border-b bg-surface">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4 md:px-6", narrow ? "max-w-[640px]" : "max-w-[1120px]")}>
          {store ? (
            <Link href={`/s/${store.slug}`} className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-control">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary font-mono text-xs font-semibold text-primary-foreground">
                {store.logoText}
              </span>
              <span className="truncate font-display text-lg">{store.name}</span>
            </Link>
          ) : (
            <span className="h-9 w-40 animate-pulse rounded-control bg-muted" aria-hidden />
          )}
        </div>
      </header>
      <main id="main" className={cn("mx-auto w-full flex-1 px-4 py-6 md:px-6 md:py-10", narrow ? "max-w-[640px]" : "max-w-[1120px]")}>
        {children}
      </main>
      <footer className="border-t bg-surface">
        <div className={cn("mx-auto flex flex-col gap-3 px-4 py-6 text-sm md:flex-row md:items-center md:px-6", narrow ? "max-w-[640px]" : "max-w-[1120px]")}>
          <nav aria-label="Help" className="flex min-w-0 flex-wrap gap-x-5">
            <Link href="/lookup" className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline">Find my order</Link>
            {store ? <Link href={`/s/${store.slug}/policies/refund`} className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline">Refunds and support</Link> : <Link href="/lookup#help" className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline">Refunds and support</Link>}
            {store && <a href={`mailto:${store.supportEmail}`} className="inline-flex min-h-11 min-w-0 max-w-full items-center break-all text-muted-foreground underline-offset-4 hover:underline">{store.supportEmail}</a>}
          </nav>
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground md:ml-auto">
            <LogoMark className="size-4" /> Sold with PowerProof
          </Link>
        </div>
      </footer>
    </div>
  );
  return theme ? <StoreThemeScope theme={theme}>{body}</StoreThemeScope> : body;
}

