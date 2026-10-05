"use client";

import { ScrollRegion } from "@/components/pp/scroll-region";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function copyText(text: string, what = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(what);
    return true;
  } catch {
    toast.error("Couldn't copy. Select the text and copy it by hand.");
    return false;
  }
}

export function CopyField({
  value,
  label,
  display,
  toastText = "Link copied",
  className,
  multiline,
  onCopied,
}: {
  /** Runs after a successful copy (e.g. marking the store link as shared) */
  onCopied?: () => void;
  value: string;
  label?: string;
  display?: string;
  toastText?: string;
  className?: string;
  multiline?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}>
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex min-w-0 items-stretch overflow-hidden rounded-control border border-border-strong bg-surface-sunken">
        {multiline ? (
          <ScrollRegion as="pre" label={label ?? "Code"} className="max-h-40 min-w-0 flex-1 overflow-auto px-3.5 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap">{display ?? value}</ScrollRegion>
        ) : (
          <span className="flex min-h-11 min-w-0 flex-1 items-center truncate px-3.5 font-mono text-[0.8125rem]">{display ?? value}</span>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-11 rounded-none border-l border-border-strong px-4"
          onClick={async () => {
            if (await copyText(value, toastText)) {
              onCopied?.();
              setDone(true);
              setTimeout(() => setDone(false), 1600);
            }
          }}
          aria-label={label ? `Copy ${label.toLowerCase()}` : "Copy"}
        >
          {done ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
          <span className="max-sm:sr-only">{done ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    </div>
  );
}
