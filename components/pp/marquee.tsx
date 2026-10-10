import { cn } from "@/lib/utils";

const SECONDS = { slow: 60, normal: 35, fast: 18 } as const;

/**
 * A line of items that scrolls sideways forever. The items are repeated so the loop has no gap;
 * the repeat is hidden from screen readers. With reduced motion it stops and wraps instead.
 */
export function Marquee({
  children,
  speed = "normal",
  reverse,
  pauseOnHover = true,
  className,
  label,
}: {
  children: React.ReactNode;
  speed?: keyof typeof SECONDS;
  reverse?: boolean;
  pauseOnHover?: boolean;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("pp-marquee overflow-hidden", className)} role="group" aria-label={label} data-reverse={reverse ? "" : undefined} data-pause={pauseOnHover ? "" : undefined} style={{ "--pp-marquee-s": `${SECONDS[speed]}s` } as React.CSSProperties}>
      <div className="pp-marquee-track">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden data-dup>{children}</div>
      </div>
    </div>
  );
}
