"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { isActive, type NavGroup } from "./nav-config";

export function SidebarNav({
  groups,
  tone = "light",
  footer,
  onNavigate,
  className,
}: {
  groups: NavGroup[];
  /** "admin" uses the darker emerald shell */
  tone?: "light" | "admin";
  footer?: React.ReactNode;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const admin = tone === "admin";
  return (
    <div className={cn("flex h-full flex-col", admin ? "bg-sidebar-admin text-primary-foreground" : "bg-surface", className)}>
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo href={admin ? "/admin" : "/dashboard"} inverted={admin} />
        {admin && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-foreground uppercase">Admin</span>}
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g, gi) => (
          <div key={gi} className="mt-4 first:mt-1">
            {g.label && <p className={cn("eyebrow mb-1.5 px-3", admin && "text-primary-foreground/60")}>{g.label}</p>}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const active = !item.soon && isActive(pathname, item);
                const Icon = item.icon;
                if (item.soon) {
                  return (
                    <li key={item.label}>
                      <span
                        aria-disabled
                        className={cn(
                          "flex min-h-10 items-center gap-3 rounded-control px-3 text-sm",
                          admin ? "text-primary-foreground/45" : "text-muted-foreground/80"
                        )}
                      >
                        <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden />
                        {item.label}
                        <span className="ml-auto rounded-full bg-accent-soft px-1.5 py-px font-mono text-[10px] text-accent-ink">SOON</span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150 max-md:min-h-11",
                        admin
                          ? active
                            ? "bg-primary-foreground/12 text-primary-foreground"
                            : "text-primary-foreground/75 hover:bg-primary-foreground/8 hover:text-primary-foreground"
                          : active
                            ? "bg-primary-soft text-primary"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {active && <span className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-accent" aria-hidden />}
                      <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {footer && <div className="shrink-0 border-t border-current/10 p-3">{footer}</div>}
    </div>
  );
}
