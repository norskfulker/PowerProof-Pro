"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brush, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSetupMode, type SetupWay } from "./use-setup-mode";

const WAYS: { way: SetupWay; label: string; Icon: typeof Sparkles }[] = [
  { way: "ai", label: "Create with AI", Icon: Sparkles },
  { way: "manual", label: "Create custom", Icon: Brush },
];

/**
 * Create with AI (AI Studio) or Create custom (the editor), at the top of both. Until the store first
 * opens, the way picked here is saved as the store's way and can be switched freely; switching to AI
 * for the first time starts with an AI draft of the whole store. Once the store has opened its way
 * stays the default (marked here) and the other is still one click away.
 */
export function BuildWaySwitch({ current, beforeLeave, compact }: { /** The screen this sits on */ current: SetupWay; /** Saves the page first */ beforeLeave?: () => Promise<void>; /** Icons only, for a crowded bar (the label shows on hover) */ compact?: boolean }) {
  const router = useRouter();
  const { mode, open, ready, remember } = useSetupMode();
  const [going, setGoing] = useState<SetupWay>();

  async function go(way: SetupWay) {
    if (way === current || going) return;
    setGoing(way);
    try {
      await beforeLeave?.();
      const first = !open && ready && way === "ai" && mode !== "ai";
      await remember(way);
      router.push(way === "ai" ? (first ? "/store/current/design/ai" : "/store/current/design/studio") : "/store/current/design/pages/home/edit");
    } catch (e) {
      setGoing(undefined);
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const hint = !ready ? undefined : open ? `Your store was built ${mode === "ai" ? "with AI" : "custom"}. Both ways stay open.` : "You can switch until your store opens.";
  return (
    <div role="radiogroup" aria-label="How you build your store" title={hint} className="inline-flex h-control shrink-0 items-center rounded-full bg-muted p-0.5 text-xs font-medium pointer-coarse:min-h-control-touch">
      {WAYS.map(({ way, label, Icon }) => (
        <button
          key={way}
          type="button"
          role="radio"
          aria-checked={current === way}
          disabled={!!going}
          onClick={() => void go(way)}
          title={compact ? label : undefined}
          className={cn("inline-flex h-full items-center gap-1.5 rounded-full whitespace-nowrap", compact ? "px-2.5" : "px-3", current === way ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {going === way ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
          <span className={compact ? "sr-only" : "max-sm:sr-only"}>{label}</span>
          {ready && mode === way && <span className="size-1.5 rounded-full bg-primary" aria-label={open ? "(your store's way)" : "(your choice)"} />}
        </button>
      ))}
    </div>
  );
}
