"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The bell. Sales, payout and refund alerts need payments and emails to be connected; until
 * then it opens to an honest empty state instead of made-up alerts.
 */
export function Notifications() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-32px))] p-0">
        <div className="border-b px-4 py-3">
          <p className="font-semibold">Notifications</p>
        </div>
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet. Sales and payouts will show up here once payments are connected.</p>
      </PopoverContent>
    </Popover>
  );
}
