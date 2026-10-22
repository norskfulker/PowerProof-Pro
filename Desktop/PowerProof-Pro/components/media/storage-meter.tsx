"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { getStorageUsage } from "@/lib/api";
import { formatBytes } from "@/lib/money";
import { cn } from "@/lib/utils";

/** The state of a meter: calm, nearly full (from 90%), or full. */
export function storageState(used: number, quota: number): "ok" | "near" | "full" {
  return used >= quota ? "full" : used / quota >= 0.9 ? "near" : "ok";
}

/** "1.2 GB of 2 GB used" for the store's media library, refreshed after every upload or delete. */
export function StorageMeter({ className }: { className?: string }) {
  const { data, error, reload } = useApi(getStorageUsage, [], { live: true });
  if (error) {
    return (
      <p role="alert" className={cn("mb-4 text-sm text-muted-foreground", className)}>
        We couldn&apos;t check your storage. <button type="button" className="font-medium underline underline-offset-4" onClick={reload}>Try again</button>
      </p>
    );
  }
  if (!data) return <Skeleton className={cn("mb-4 h-12 max-w-md rounded-control", className)} />;
  const state = storageState(data.used, data.quota);
  const pct = Math.min(100, (data.used / data.quota) * 100);
  return (
    <div className={cn("mb-4 flex max-w-md flex-col gap-1.5", className)}>
      <p className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">Storage</span>
        <span className={cn("font-mono text-xs", state !== "ok" && "font-semibold text-warning-ink")}>{formatBytes(data.used)} of {formatBytes(data.quota)} used</span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Media storage used" aria-valuemin={0} aria-valuemax={data.quota} aria-valuenow={Math.min(data.used, data.quota)} aria-valuetext={`${formatBytes(data.used)} of ${formatBytes(data.quota)}`}>
        <div className={cn("h-full rounded-full", state === "ok" ? "bg-primary" : "bg-warning")} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {state === "full" ? "Your library is full. Delete files you don't use to upload more." : state === "near" ? "Nearly full. Delete files you don't use to make room." : "Photos are shrunk automatically when you upload them."}
      </p>
    </div>
  );
}
