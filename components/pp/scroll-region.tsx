"use client";

import { useScrollFocus } from "@/hooks/use-scroll-focus";
import { cn } from "@/lib/utils";

/** A scroll container that becomes a focusable, labelled region while its content overflows. */
export function ScrollRegion({ label, className, children, as: Tag = "div" }: { label: string; className?: string; children: React.ReactNode; as?: "div" | "pre" }) {
  const ref = useScrollFocus<HTMLDivElement & HTMLPreElement>(label);
  return (
    <Tag ref={ref} className={cn("focus-visible:outline-2 focus-visible:outline-ring", className)}>
      {children}
    </Tag>
  );
}
