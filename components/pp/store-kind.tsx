import { cn } from "@/lib/utils";

export type StoreSells = "digital" | "physical";

export const STORE_KIND: Record<StoreSells, { label: string; short: string; body: string }> = {
  digital: { label: "Digital store", short: "Digital", body: "Sells downloads and online access. Nothing ships." },
  physical: { label: "Physical store", short: "Physical", body: "Sells physical goods that ship to the buyer." },
};

/**
 * What kind of store this is, said the same way everywhere: a text badge, tinted by kind.
 * `compact` drops the word "store" for tight rows (menus, cards).
 */
export function StoreKind({ sells, compact = false, className }: { sells: StoreSells; compact?: boolean; className?: string }) {
  const k = STORE_KIND[sells];
  return (
    <span
      title={k.body}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap [overflow-wrap:normal]",
        sells === "physical" ? "bg-accent/15 text-accent-ink" : "bg-primary-soft text-primary",
        className
      )}
    >
      {compact ? k.short : k.label}
    </span>
  );
}
