"use client";

import Link from "next/link";
import { Shield, User } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { cn } from "@/lib/utils";

/**
 * For PowerProof staff: switch between the user view (their own workspace) and the admin view.
 * Shown at the top of the sidebar in both; nobody else sees it.
 */
export function ViewModeSwitch({ mode, collapsed, onNavigate }: { mode: "user" | "admin"; collapsed?: boolean; onNavigate?: () => void }) {
  const admin = useIsAdmin();
  if (!admin && mode === "user") return null;
  const items = [
    { id: "user" as const, label: "User", href: "/dashboard", icon: User },
    { id: "admin" as const, label: "Admin", href: "/admin", icon: Shield },
  ];
  if (collapsed) {
    const other = items.find((i) => i.id !== mode)!;
    return (
      <Link href={other.href} onClick={onNavigate} title={`Switch to ${other.label.toLowerCase()} view`} aria-label={`Switch to ${other.label.toLowerCase()} view`} className={cn("mx-auto mb-2 grid size-10 place-items-center rounded-control", mode === "admin" ? "text-sidebar-admin-foreground hover:bg-sidebar-admin-foreground/10" : "text-muted-foreground hover:bg-muted")}>
        <other.icon className="size-4" aria-hidden />
      </Link>
    );
  }
  return (
    <nav aria-label="View mode" className={cn("mx-3 mb-3 grid grid-cols-2 gap-1 rounded-control p-1", mode === "admin" ? "bg-sidebar-admin-foreground/10" : "bg-muted")}>
      {items.map((i) => {
        const on = i.id === mode;
        return (
          <Link
            key={i.id}
            href={i.href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center justify-center gap-1.5 rounded-[6px] text-xs font-semibold transition-colors",
              on ? "bg-surface text-foreground shadow-xs" : mode === "admin" ? "text-sidebar-admin-foreground/80 hover:text-sidebar-admin-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <i.icon className="size-3.5" aria-hidden /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
