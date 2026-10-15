"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertOctagon, Bell, Boxes, CheckCheck, HandCoins, Inbox, MessageCircleQuestion, Receipt, RotateCcw, Settings, Star, Truck, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification, type NotificationKind } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICON: Record<NotificationKind, LucideIcon> = {
  order: Receipt,
  cod: HandCoins,
  refund: RotateCcw,
  dispute: AlertOctagon,
  review: Star,
  question: MessageCircleQuestion,
  lead: Inbox,
  payout_paid: Wallet,
  payout_failed: Wallet,
  low_stock: Boxes,
  shipped: Truck,
};
const ALERT: NotificationKind[] = ["dispute", "payout_failed", "low_stock"];

/** Buyers pay in other browsers, so the bell also checks every minute while the tab is open */
const POLL_MS = 60_000;

/**
 * The bell: orders, refunds, disputes, reviews, questions, form sign-ups, payouts and stock, for
 * the parts of the store this person works on. Opening one marks it read and goes to it.
 */
export function Notifications() {
  const router = useRouter();
  const { data, loading, error, reload, setData } = useApi(() => getNotifications(30), [], { live: true });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && reload(), POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  const unread = data?.unread ?? 0;
  const go = async (n: AppNotification) => {
    setOpen(false);
    if (!n.read && data) {
      setData({ items: data.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)), unread: Math.max(0, data.unread - 1) });
      void markNotificationRead(n.id).catch(() => reload());
    }
    if (n.href) router.push(n.href);
  };
  const readAll = async () => {
    if (data) setData({ items: data.items.map((x) => ({ ...x, read: true })), unread: 0 });
    await markAllNotificationsRead().catch(() => reload());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative">
          <Bell />
          {unread > 0 && (
            <span aria-hidden className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] leading-4 font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-32px))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="font-semibold">Notifications</p>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={readAll}>
                <CheckCheck aria-hidden /> Mark all read
              </Button>
            )}
            <Button asChild variant="ghost" size="icon-sm" aria-label="Notification settings">
              <Link href="/settings/profile#notifications" onClick={() => setOpen(false)}><Settings /></Link>
            </Button>
          </div>
        </div>
        <div className="max-h-[min(70vh,480px)] overflow-y-auto">
          {error && !data ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm">
              <p className="text-muted-foreground">Notifications couldn&apos;t load.</p>
              <Button variant="secondary" size="sm" onClick={reload}>Try again</Button>
            </div>
          ) : loading && !data ? (
            <div className="flex flex-col gap-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !data?.items.length ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet. New orders, reviews, questions and payouts show up here.</p>
          ) : (
            <ul className="divide-y">
              {data.items.map((n) => {
                const Icon = ICON[n.kind] ?? Bell;
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => go(n)} className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-muted", !n.read && "bg-primary-soft/40")}>
                      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", ALERT.includes(n.kind) ? "bg-warning-soft text-warning-ink" : "bg-primary-soft text-primary")}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", !n.read && "font-semibold")}>{n.title}</span>
                        {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                        <span className="mt-0.5 block text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
