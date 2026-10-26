"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useInSettings } from "@/components/settings/in-settings";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  actions,
  back,
  className,
  top,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
  /** The page's own title even inside Settings (the "Settings" title itself) */
  top?: boolean;
}) {
  // Inside Settings, a page's title is a section heading under "Settings"
  const section = useInSettings() && !top;
  const Title = section ? "h2" : "h1";
  return (
    <header className={cn(section ? "mb-4" : "mb-6 md:mb-8", className)}>
      {back && (
        <Link href={back.href} className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-sm font-medium text-muted-foreground hover:text-foreground pointer-fine:min-h-8">
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      {/* The title and its buttons share one row */}
      <div className="flex items-center justify-between gap-4">
        <Title className={cn("min-w-0", section ? "font-display text-xl" : "text-[1.75rem] leading-[1.1] md:text-[2.125rem]")}>{title}</Title>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
