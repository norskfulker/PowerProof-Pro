"use client";

import Link from "next/link";
import { Bell, IndianRupee, RotateCcw, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getNotifications, markNotificationsRead } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@/lib/types";

const ICON: Record<Notification["kind"], React.ComponentType<{ className?: string }>> = {
  sale: IndianRupee,
  payout: Wallet,
  refund: RotateCcw,
  system: Sparkles,
};

export function Notifications() {
  const { data, loading } = useApi(getNotifications, [], { live: true });
  const unread = data?.filter((n) => !n.read).length ?? 0;

  return (
    <Popover onOpenChange={(o) => !o && unread && markNotificationsRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative">
          <Bell />
          {unread > 0 && (
            <span className="absolute top-2 right-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[0.625rem] font-semibold text-accent-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-32px))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Notifications</p>
          {unread > 0 && <span className="eyebrow">{unread} new</span>}
        </div>
        <ul className="max-h-96 overflow-y-auto py-1">
          {loading && !data
            ? Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="px-4 py-3">
                  <Skeleton className="h-10 w-full" />
                </li>
              ))
            : data?.length === 0
              ? <li className="px-4 py-8 text-center text-sm text-muted-foreground">All quiet. Sales and payouts show up here.</li>
              : data?.map((n) => {
                  const Icon = ICON[n.kind];
                  return (
                    <li key={n.id}>
                      <Link href={n.href ?? "#"} className="flex gap-3 px-4 py-3 hover:bg-muted">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            {n.title}
                            {!n.read && <span className="size-1.5 rounded-full bg-accent" aria-label="unread" />}
                          </span>
                          <span className="block truncate text-sm text-muted-foreground">{n.body}</span>
                          <span className="font-mono text-[0.6875rem] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
