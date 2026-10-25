import Link from "next/link";
import { cn } from "@/lib/utils";

/** PowerProof wordmark: plain Geist ExtraBold text, no icon (same as the emails). */
export function Logo({
  href = "/",
  className,
  inverted,
}: {
  href?: string | null;
  className?: string;
  inverted?: boolean;
}) {
  const body = (
    <span
      className={cn(
        "font-sans text-[1.25rem] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap",
        inverted ? "text-sidebar-admin-foreground" : "text-foreground",
        className
      )}
    >
      PowerProof
    </span>
  );
  if (href === null) return body;
  return (
    <Link href={href} aria-label="PowerProof home" className="inline-flex min-h-11 items-center rounded-control">
      {body}
    </Link>
  );
}
