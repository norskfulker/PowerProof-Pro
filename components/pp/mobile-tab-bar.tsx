"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActive, type NavItem } from "./nav-config";

export function MobileTabBar({ tabs, onMore }: { tabs: NavItem[]; onMore: () => void }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Quick"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(pathname, t);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-primary-soft")}>
                  <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground"
          >
            <span className="grid h-7 w-12 place-items-center">
              <Menu className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
