import Link from "next/link";
import { cn } from "@/lib/utils";

/** PowerProof wordmark: a brass proof-tick inside an emerald tile. */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" className={inverted ? "fill-primary-foreground" : "fill-primary"} />
      <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-accent" />
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  inverted,
  compact,
}: {
  href?: string | null;
  className?: string;
  inverted?: boolean;
  compact?: boolean;
}) {
  const body = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark inverted={inverted} />
      {!compact && (
        <span
          className={cn(
            "font-display text-[20px] leading-none font-extrabold tracking-[-0.03em]",
            inverted ? "text-primary-foreground" : "text-foreground"
          )}
        >
          PowerProof
        </span>
      )}
    </span>
  );
  if (href === null) return body;
  return (
    <Link href={href} aria-label="PowerProof home" className="inline-flex min-h-11 items-center rounded-control">
      {body}
    </Link>
  );
}
