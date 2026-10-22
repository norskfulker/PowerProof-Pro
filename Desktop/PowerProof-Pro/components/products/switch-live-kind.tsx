"use client";

import { useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { switchLiveKind, type LiveKindSwitch } from "@/lib/api";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "digital" | "physical";
const plural = (n: number, word: string) => `${n} ${word} product${n === 1 ? "" : "s"}`;

/** What happened, in one line, for the toast and the AI */
export function switchSummary(r: LiveKindSwitch): string {
  const live = r.live ? `${plural(r.live, r.to)} live` : `No ${r.to} products were ready to go live`;
  const moved = r.paused ? `, ${plural(r.paused, r.from)} moved to drafts` : "";
  return `${live}${moved}.`;
}

/**
 * Switches the store between digital and physical in one click: the live kind goes to drafts and
 * the other kind goes live (the database does both at once). The toast offers Undo, which switches
 * straight back and brings back exactly what was live.
 */
export function useSwitchLiveKind() {
  const [busy, setBusy] = useState(false);
  async function run(to: Kind, undo = false) {
    setBusy(true);
    try {
      const r = await switchLiveKind(to);
      toast.success(undo ? `Back to ${to}` : `Switched to ${to}`, {
        description: `${switchSummary(r)}${!r.live && r.drafts ? ` Finish ${r.drafts === 1 ? "it" : "them"} (${to === "digital" ? "add the file" : "put it in a collection"}), then make ${r.drafts === 1 ? "it" : "them"} live.` : ""}`,
        ...(undo ? {} : { action: { label: "Undo", onClick: () => void run(r.from, true) } }),
      });
      return r;
    } catch (e) {
      toast.error("Couldn't switch", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }
  return { run: (to: Kind) => run(to), busy };
}

/** The kind that's live in these products, if any */
export const liveKindOf = (products: Pick<Product, "fulfilment" | "status">[] | undefined): Kind | undefined => products?.find((p) => p.status === "published")?.fulfilment;

export function SwitchLiveKindButton({ to, className, size = "sm", variant = "secondary" }: { to: Kind; className?: string; size?: "sm" | "md"; variant?: "primary" | "secondary" }) {
  const s = useSwitchLiveKind();
  return (
    <Button type="button" size={size} variant={variant} disabled={s.busy} onClick={() => void s.run(to)} className={cn("relative z-10", className)}>
      {s.busy ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowLeftRight aria-hidden />} Switch to {to}
    </Button>
  );
}
