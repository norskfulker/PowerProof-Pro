import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Colour pairs for the blob behind the glass: sunny and natural, never neon */
export const GLASS_TONES = {
  emerald: ["#34d399", "#0f9f6e"],
  mint: ["#7ee8c0", "#22b38a"],
  amber: ["#ffcf66", "#f59e0b"],
  coral: ["#ffb199", "#f2685a"],
  sky: ["#8fd3ff", "#2b9fe0"],
  lime: ["#d4f27a", "#7cc63a"],
  slate: ["#c3cbd3", "#6b7a88"],
} as const;
export type GlassTone = keyof typeof GLASS_TONES;

const SIZE = { sm: "size-8 [&_svg]:size-4", md: "size-10 [&_svg]:size-[18px]", lg: "size-12 [&_svg]:size-5", xl: "size-16 [&_svg]:size-7" } as const;

/** A frosted-glass icon tile over a coloured blob. Lit from the pointer (see GlassLight). */
export function GlassIcon({ icon: Icon, tone = "emerald", size = "md", className }: { icon: LucideIcon; tone?: GlassTone; size?: keyof typeof SIZE; className?: string }) {
  const [a, b] = GLASS_TONES[tone];
  return (
    <span aria-hidden className={cn("glass-icon", SIZE[size], className)} style={{ "--gi": a, "--gi2": b } as React.CSSProperties}>
      <Icon strokeWidth={2} />
    </span>
  );
}

