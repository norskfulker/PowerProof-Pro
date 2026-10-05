"use client";

import { AlertTriangle, Ban, Copy, EyeOff, Flag, Gavel, HelpCircle, Package, Receipt, RotateCcw, Star, Store, Tag, User, Users, Wallet, type LucideIcon } from "lucide-react";
import { MoneyText } from "@/components/pp/money-text";
import { StatusPill } from "@/components/pp/status-pill";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { QuickAction, SearchResult, SearchType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { contactKey } from "./search-actions";

export const TYPE_ICONS: Record<SearchType, LucideIcon> = {
  creator: User,
  store: Store,
  product: Package,
  order: Receipt,
  buyer: Users,
  payout: Wallet,
  dispute: Gavel,
  review: Star,
  question: HelpCircle,
  coupon: Tag,
  invoice: Receipt,
  flag: Flag,
};

const ACTION_META: Record<Exclude<QuickAction, "open">, { label: string; icon: LucideIcon; danger?: boolean }> = {
  copy: { label: "Copy ID", icon: Copy },
  refund: { label: "Refund", icon: RotateCcw, danger: true },
  hide_review: { label: "Hide", icon: EyeOff, danger: true },
  suspend_store: { label: "Suspend", icon: Ban, danger: true },
};

/** Masked contact with a Reveal button, or the revealed value. */
export function ContactLine({ result, revealed, onReveal }: { result: SearchResult; revealed: Record<string, string>; onReveal?: (field: "email" | "phone") => void }) {
  const fields = (["email", "phone"] as const).filter((f) => result[f]);
  if (!fields.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {fields.map((f) => {
        const value = revealed[contactKey(result, f)];
        return (
          <span key={f} className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <span className="truncate [overflow-wrap:anywhere]">{value ?? result[f]}</span>
            {result.masked && !value && onReveal && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onReveal(f);
                }}
                className="inline-flex min-h-8 items-center rounded-control px-1.5 font-sans font-semibold text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
                aria-label={`Reveal ${f} for ${result.title}`}
              >
                Reveal
              </button>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function ActionButtons({ result, onAction, className }: { result: SearchResult; onAction: (a: QuickAction) => void; className?: string }) {
  const acts = result.actions.filter((a): a is Exclude<QuickAction, "open"> => a !== "open");
  return (
    <span className={cn("flex shrink-0 flex-wrap items-center gap-2", className)}>
      {acts.map((a) => {
        const m = ACTION_META[a];
        return (
          <Button
            key={a}
            type="button"
            size="sm"
            variant={m.danger ? "secondary" : "ghost"}
            className={cn(m.danger && "text-danger")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAction(a);
            }}
            aria-label={`${m.label}: ${result.title}`}
          >
            <m.icon aria-hidden /> <span className="max-sm:sr-only">{m.label}</span>
          </Button>
        );
      })}
    </span>
  );
}

/** One result: icon, title, context, status, amount, contact and quick actions. */
export function ResultRow({
  result,
  revealed,
  onReveal,
  onAction,
  showActions = true,
  showStore,
}: {
  result: SearchResult;
  revealed: Record<string, string>;
  onReveal?: (field: "email" | "phone") => void;
  onAction: (a: QuickAction) => void;
  showActions?: boolean;
  showStore?: boolean;
}) {
  const Icon = TYPE_ICONS[result.type] ?? AlertTriangle;
  return (
    <span className="flex w-full min-w-0 flex-wrap items-start gap-x-3 gap-y-2">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-control bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-[1_1_12rem] flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("min-w-0 font-semibold [overflow-wrap:anywhere]", (result.type === "order" || result.type === "invoice" || result.type === "coupon") && "font-mono text-sm")}>{result.title}</span>
          {result.status && <StatusPill status={result.status} />}
        </span>
        {result.subtitle && <span className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{result.subtitle}</span>}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {showStore && result.storeName && <span className="[overflow-wrap:anywhere]">{result.storeName}</span>}
          {result.date && <span>{formatDate(result.date)}</span>}
          {result.amount && <MoneyText value={result.amount} className="font-medium text-foreground" />}
        </span>
        <ContactLine result={result} revealed={revealed} onReveal={onReveal} />
      </span>
      {showActions && <ActionButtons result={result} onAction={onAction} />}
    </span>
  );
}
