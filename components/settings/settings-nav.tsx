"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_NAV } from "@/components/pp/nav-config";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="-mx-[16px] overflow-x-auto px-[16px] lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-2 lg:gap-1 lg:sticky lg:top-24 lg:flex-col lg:pointer-coarse:gap-2">
        {SETTINGS_NAV.map((i) => {
          const active = pathname === i.href;
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-control px-3 text-sm font-medium whitespace-nowrap lg:min-h-10 lg:pointer-coarse:min-h-11",
                  active ? "bg-primary-soft text-primary" : "text-foreground/80 hover:bg-muted"
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
