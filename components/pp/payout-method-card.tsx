import { Coins, Landmark, ShieldCheck } from "lucide-react";
import type { PayoutMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusPill } from "./status-pill";

export function PayoutMethodCard({
  method,
  selected,
  onSelect,
  className,
  action,
}: {
  method: PayoutMethod;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
  action?: React.ReactNode;
}) {
  const Icon = method.kind === "crypto" ? Coins : Landmark;
  const disabled = false;
  const body = (
    <>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-control", disabled ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {method.label}
          {method.primary ? (
            <StatusPill status="primary" label="Primary" tone="neutral" />
          ) : null}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {method.kind === "crypto" && method.address
            ? `${method.address.slice(0, 6)}…${method.address.slice(-6)}`
            : `${method.holderName} · ····${method.last4}${method.ifsc ? ` · ${method.ifsc}` : ""}`}
        </span>
        {method.kind !== "crypto" && method.verified && (
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success">
            <ShieldCheck className="size-3.5" aria-hidden /> Verified with a ₹1 test deposit
          </span>
        )}
      </span>
      {action}
    </>
  );
  const cls = cn(
    "flex w-full items-center gap-4 rounded-card border bg-surface p-4 text-left transition-[border-color] duration-150",
    onSelect && !disabled && "hover:border-border-strong",
    selected && "border-primary outline-2 outline-primary",
    disabled && "bg-surface-sunken",
    className
  );
  if (onSelect) {
    return (
      <button type="button" className={cls} onClick={onSelect} disabled={disabled} aria-pressed={selected}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
