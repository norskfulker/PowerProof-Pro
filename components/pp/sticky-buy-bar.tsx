"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Money } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MoneyText } from "./money-text";

/**
 * Phone-only buy bar that slides in once the main Buy button scrolls out of view.
 * Pass the id of the main button's wrapper as `watchId`.
 */
export function StickyBuyBar({ watchId, title, price, onBuy, buying }: { watchId: string; title: string; price: Money; onBuy: () => void; buying?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  return (
    <div
      aria-hidden={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t bg-surface px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] transition-transform duration-200 ease-out md:hidden",
        show ? "translate-y-0" : "pointer-events-none translate-y-full"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <MoneyText value={price} className="text-sm" />
        </span>
        <Button onClick={onBuy} disabled={buying} tabIndex={show ? 0 : -1} size="lg" className="shrink-0">
          {buying && <Loader2 className="animate-spin" aria-hidden />} Buy now
        </Button>
      </div>
    </div>
  );
}
